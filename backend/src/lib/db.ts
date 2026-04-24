import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
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
};
