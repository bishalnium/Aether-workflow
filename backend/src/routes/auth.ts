// ===========================================
// AETHER - OAuth Authentication Routes
// GitHub, Google OAuth with PostgreSQL persistence
// ===========================================

import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prismaClient';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'aether-jwt-secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Helper: Upsert user in PostgreSQL (create if not exists, update if exists)
async function upsertUser(userData: {
  email: string;
  name: string;
  avatar?: string;
  provider: string;
  providerId: string;
}) {
  const user = await prisma.user.upsert({
    where: { email: userData.email },
    update: {
      name: userData.name,
      avatar: userData.avatar,
    },
    create: {
      email: userData.email,
      name: userData.name,
      avatar: userData.avatar,
    }
  });
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    provider: userData.provider,
    providerId: userData.providerId,
    createdAt: user.createdAt.toISOString(),
  };
}

// Helper to create JWT token
const createToken = (user: any): string => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name,
      avatar: user.avatar,
      picture: user.avatar, // Alias for compatibility
      provider: user.provider
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ===========================================
// GITHUB OAUTH
// ===========================================

// Step 1: Redirect to GitHub
router.get('/github', (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/github/callback`;
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  
  res.redirect(githubAuthUrl);
});

// Step 2: GitHub callback
router.get('/github/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect(`${FRONTEND_URL}?error=github_auth_failed`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    if (!accessToken) {
      throw new Error('No access token received');
    }

    // Get user info from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // Get user email (might be private)
    const emailsResponse = await axios.get('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const primaryEmail = emailsResponse.data.find((e: any) => e.primary)?.email || 
                         emailsResponse.data[0]?.email ||
                         `${userResponse.data.login}@github.local`;

    const githubUser = userResponse.data;

    // Create or update user in PostgreSQL
    const user = await upsertUser({
      email: primaryEmail,
      name: githubUser.name || githubUser.login,
      avatar: githubUser.avatar_url,
      provider: 'github',
      providerId: githubUser.id.toString(),
    });

    // Create JWT token
    const token = createToken(user);

    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}?auth=success&token=${token}&provider=github`);

  } catch (error: any) {
    console.error('GitHub OAuth error:', error.message);
    res.redirect(`${FRONTEND_URL}?error=github_auth_failed&message=${encodeURIComponent(error.message)}`);
  }
});

// ===========================================
// GOOGLE OAUTH
// ===========================================

// Step 1: Redirect to Google
router.get('/google', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ');

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
  
  res.redirect(googleAuthUrl);
});

// Step 2: Google callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect(`${FRONTEND_URL}?error=google_auth_failed`);
  }

  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Get user info from Google
    const userResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const googleUser = userResponse.data;

    // Create or update user in PostgreSQL
    const user = await upsertUser({
      email: googleUser.email,
      name: googleUser.name,
      avatar: googleUser.picture,
      provider: 'google',
      providerId: googleUser.id,
    });

    // Create JWT token
    const token = createToken(user);

    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}?auth=success&token=${token}&provider=google`);

  } catch (error: any) {
    console.error('Google OAuth error:', error.message);
    res.redirect(`${FRONTEND_URL}?error=google_auth_failed&message=${encodeURIComponent(error.message)}`);
  }
});

// ===========================================
// TOKEN VERIFICATION
// ===========================================

router.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, user: decoded });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// ===========================================
// GET USER BY TOKEN
// ===========================================

router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Try to get user from database
    const dbUser = await prisma.user.findFirst({ where: { email: decoded.email } });
    
    if (dbUser) {
      res.json({ success: true, user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        avatar: dbUser.avatar,
        provider: decoded.provider,
        createdAt: dbUser.createdAt.toISOString(),
      }});
    } else {
      res.json({ success: true, user: decoded });
    }
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

export default router;
