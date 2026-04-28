import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

let prisma: PrismaClient;
let pool: Pool | null = null;

const getPgPool = (): Pool => {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  pool = connectionString ? new Pool({ connectionString }) : new Pool();
  return pool;
};

const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    const adapter = new PrismaPg(getPgPool());
    prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prisma;
};

export const db = getPrismaClient();

/**
 * Disconnect Prisma client gracefully
 */
export const disconnectDb = async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
};
