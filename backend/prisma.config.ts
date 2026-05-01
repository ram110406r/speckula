/// <reference types="node" />
import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` reads the schema only — it never opens a DB connection.
// Using process.env directly (with fallback) avoids the PrismaConfigEnvError
// that `env()` throws when DATABASE_URL is absent in CI or fresh checkouts.
//
// `prisma migrate` / `prisma db push` DO connect and will fail at runtime if
// DATABASE_URL is wrong — the fallback only protects the generate step.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/buildcase",
  },
});
