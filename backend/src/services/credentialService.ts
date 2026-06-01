// ===========================================
// AETHER WORKFLOW ENGINE - Credential Service
// Secure storage using Aiven PostgreSQL
// Encrypted with AES-256 before storing in DB
// ===========================================

import { encryption } from '../utils/encryption';
import { logger } from '../utils/logger';
import prisma from '../utils/prismaClient';

// Map frontend type strings to Prisma enum values
function toCredentialType(type: string): 'API_KEY' | 'OAUTH2' | 'BASIC_AUTH' | 'SMTP' | 'DATABASE' | 'AWS' | 'GOOGLE' | 'SLACK' | 'CUSTOM' {
  const validTypes = ['API_KEY', 'OAUTH2', 'BASIC_AUTH', 'SMTP', 'DATABASE', 'AWS', 'GOOGLE', 'SLACK', 'CUSTOM'];
  const upper = type?.toUpperCase() || 'API_KEY';
  return validTypes.includes(upper) ? upper as any : 'API_KEY';
}

export const credentialService = {
  /**
   * Store encrypted credentials in PostgreSQL
   */
  async store(
    userId: string,
    name: string,
    type: string,
    data: Record<string, any>,
    provider?: string,
    model?: string
  ): Promise<string> {
    const encrypted = encryption.encrypt(data);

    // Find or create user first
    let user = await prisma.user.findFirst({ where: { email: userId } });
    if (!user) {
      // Create a placeholder user record if they don't exist yet
      user = await prisma.user.create({
        data: {
          email: userId,
          name: userId.split('@')[0] || 'User',
        }
      });
      logger.info(`Created user record for: ${userId}`);
    }

    const credential = await prisma.credential.create({
      data: {
        name: provider ? `${provider}:${name}` : name,
        type: toCredentialType(type),
        data: encrypted, // AES-256 encrypted string
        userId: user.id,
      }
    });

    logger.info(`Credential stored in DB: ${name} (${type}) for user ${userId}`, { credentialId: credential.id });
    return credential.id;
  },

  /**
   * Get decrypted credentials from DB
   */
  async getDecrypted(credentialId: string, userId: string): Promise<Record<string, any> | null> {
    const user = await prisma.user.findFirst({ where: { email: userId } });
    if (!user) {
      logger.warn(`User not found: ${userId}`);
      return null;
    }

    const credential = await prisma.credential.findFirst({
      where: { id: credentialId, userId: user.id }
    });

    if (!credential) {
      logger.warn(`Credential not found: ${credentialId}`);
      return null;
    }

    return encryption.decrypt(credential.data);
  },

  /**
   * List credentials for a user (no sensitive data)
   */
  async list(userId: string): Promise<Array<{ id: string; name: string; type: string; provider?: string; createdAt: string }>> {
    const user = await prisma.user.findFirst({ where: { email: userId } });
    if (!user) return [];

    const credentials = await prisma.credential.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, type: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    return credentials.map(c => {
      const parts = c.name.split(':');
      return {
        id: c.id,
        name: parts.length > 1 ? parts.slice(1).join(':') : c.name,
        type: c.type,
        provider: parts.length > 1 ? parts[0] : undefined,
        createdAt: c.createdAt.toISOString(),
      };
    });
  },

  /**
   * Delete a credential
   */
  async delete(credentialId: string, userId: string): Promise<boolean> {
    const user = await prisma.user.findFirst({ where: { email: userId } });
    if (!user) return false;

    const credential = await prisma.credential.findFirst({
      where: { id: credentialId, userId: user.id }
    });
    if (!credential) return false;

    await prisma.credential.delete({ where: { id: credentialId } });
    logger.info(`Credential deleted from DB: ${credentialId}`);
    return true;
  },

  /**
   * Update credential data
   */
  async update(
    credentialId: string,
    userId: string,
    data: Record<string, any>
  ): Promise<boolean> {
    const user = await prisma.user.findFirst({ where: { email: userId } });
    if (!user) return false;

    const credential = await prisma.credential.findFirst({
      where: { id: credentialId, userId: user.id }
    });
    if (!credential) return false;

    await prisma.credential.update({
      where: { id: credentialId },
      data: { data: encryption.encrypt(data) }
    });

    logger.info(`Credential updated in DB: ${credentialId}`);
    return true;
  },
};

export default credentialService;
