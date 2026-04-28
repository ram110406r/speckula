import { z } from 'zod';

// Centralized env validation. Called once at server boot so a missing or
// malformed required variable fails loudly instead of crashing later in a
// route handler with a confusing error.

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z
      .string()
      .optional()
      .transform((s) => (s ? parseInt(s, 10) : 3001))
      .refine((n) => Number.isFinite(n) && n > 0 && n < 65536, 'PORT must be a valid port number'),

    // Required at boot — backend cannot serve without these.
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
    FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
    FIREBASE_CLIENT_EMAIL: z.string().min(1, 'FIREBASE_CLIENT_EMAIL is required'),
    FIREBASE_PRIVATE_KEY: z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),

    // Optional. Routes that need these will fail with their own error.
    FRONTEND_URL: z.string().optional(),
    FRONTEND_URLS: z.string().optional(),

    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    SLACK_REDIRECT_URI: z.string().optional(),
    SLACK_SIGNING_SECRET: z.string().optional(),
    SLACK_TOKEN_ENCRYPTION_KEY: z.string().optional(),

    AI_CACHE_TTL_MINUTES: z
      .string()
      .optional()
      .transform((s) => (s ? parseInt(s, 10) : undefined))
      .refine((n) => n === undefined || (Number.isFinite(n) && n > 0), 'AI_CACHE_TTL_MINUTES must be a positive integer'),

    RETENTION_DAYS: z
      .string()
      .optional()
      .transform((s) => (s ? parseInt(s, 10) : undefined))
      .refine((n) => n === undefined || (Number.isFinite(n) && n > 0), 'RETENTION_DAYS must be a positive integer'),
  })
  // strict() rejects unknown keys; we don't use it on process.env because
  // Node injects many platform vars (PATH, USERPROFILE, etc.).
  ;

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export const validateEnv = (): AppEnv => {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
};
