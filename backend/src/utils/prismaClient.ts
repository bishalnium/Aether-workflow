// ===========================================
// AETHER - Shared Prisma Client Instance
// Uses PrismaPg adapter for Prisma 7.x
// Connects to Aiven PostgreSQL
// ===========================================

import 'dotenv/config';

// Aiven uses self-signed certificates — allow them for database connections
// This is safe because we're connecting to a known, trusted cloud database
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prevent multiple instances in development (hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('[PRISMA] DATABASE_URL is not set!');
    throw new Error('DATABASE_URL environment variable is required');
  }

  console.log('[PRISMA] Connecting to Aiven PostgreSQL...');
  
  const adapter = new PrismaPg({ connectionString });
  
  const client = new PrismaClient({ 
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  console.log('[PRISMA] Client created successfully');
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
