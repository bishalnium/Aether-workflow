import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

const JWT_SECRET = process.env.JWT_SECRET || 'aether-jwt-secret-key-for-auth-2025';

// --- Authentication Middleware ---
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role: string;
    orgId: string;
  };
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = (req as any).headers?.authorization;

  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    // In dev mode, allow unauthenticated requests with a fallback user
    if (config.NODE_ENV === 'development') {
      req.user = { id: 'dev_user', email: 'dev@aether.local', role: 'admin', orgId: 'dev_org' };
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Demo token shortcut
    if (token === 'demo-token') {
       req.user = { id: 'user_123', role: 'architect', orgId: 'org_aether_01' };
       return next();
    }
    
    // Try to decode real JWT token from OAuth flow
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { 
      id: decoded.id || decoded.sub || decoded.email || 'unknown',
      email: decoded.email,
      role: decoded.role || 'user', 
      orgId: decoded.orgId || 'default' 
    };
    return next();
  } catch (error) {
    // In dev mode, fall back to dev_user for any invalid token
    if (config.NODE_ENV === 'development') {
      req.user = { id: 'dev_user', email: 'dev@aether.local', role: 'admin', orgId: 'dev_org' };
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Invalid credentials' });
  }
};

// --- Rate Limiting Middleware ---
export const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS, 
  max: config.RATE_LIMIT_MAX_REQUESTS, 
  standardHeaders: true, 
  legacyHeaders: false, 
  keyGenerator: (req: Request) => {
    // Rate limit by User ID if auth'd, otherwise by IP
    return (req as AuthenticatedRequest).user?.id || req.ip || 'unknown';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'You have exceeded your execution quota. Please upgrade your plan.'
    });
  }
});