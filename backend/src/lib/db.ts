import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

let prisma: PrismaClient | null = null;
let pool: Pool | null = null;

const getPgPool = (): Pool => {
  if (pool) return pool;
  // Read DATABASE_URL here (not at module-load time) so dotenv has already
  // had a chance to populate process.env before the Pool is created.
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

// Lazy proxy — PrismaClient (and its pg Pool) are not instantiated until the
// first property access. This guarantees dotenv.config() has already run in
// index.ts before DATABASE_URL is read, avoiding the "client password must be
// a string" SASL error that occurs when the Pool is built before env is loaded.
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

export const disconnectDb = async () => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
};
