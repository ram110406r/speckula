import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3001),

  // PostgreSQL — runtime queries use the pooled URL; migrations use the direct
  // connection (Prisma migrate deploy requires a non-pooled connection).
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid postgresql:// URL'),
  DIRECT_DATABASE_URL: z
    .string()
    .url('DIRECT_DATABASE_URL must be a valid postgresql:// URL')
    .optional(),

  // Groq — all keys issued by console.groq.com start with "gsk_".
  GROQ_API_KEY: z
    .string()
    .startsWith('gsk_', 'GROQ_API_KEY must start with "gsk_". Get one at console.groq.com'),

  // Firebase Admin SDK service account credentials.
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z
    .string()
    .email('FIREBASE_CLIENT_EMAIL must be a valid service account email address'),
  // Accept either raw PEM (with literal \n) or base64-encoded PEM.
  // Use FIREBASE_PRIVATE_KEY_B64 in environments where multiline values
  // break the .env file parser (e.g. Dokploy/Docker Compose).
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_PRIVATE_KEY_B64: z.string().optional(),

  // CORS — exact origin the frontend is served from. No trailing slash.
  FRONTEND_URL: z
    .string()
    .url('FRONTEND_URL must be a valid URL, e.g. https://app.Speckula.io')
    .optional(),
  FRONTEND_URLS: z.string().optional(),

  // Prompt cache TTL in minutes (default 60 = 1 hour).
  AI_CACHE_TTL_MINUTES: z.coerce.number().int().min(1).default(60),

  // Daily token cap per user across all Groq calls. Default 200 000 tokens
  // ≈ $0.12/user/day at llama-3.3-70b pricing. Set to 0 to disable.
  DAILY_TOKEN_QUOTA: z.coerce.number().int().min(0).default(200_000),

  // Sentry — optional, error tracking.
  SENTRY_DSN: z.string().url().optional(),

  // Optional Slack OAuth credentials (only needed if Slack integration is enabled).
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().url().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  // 64-char hex (32 bytes). Required when Slack integration is enabled.
  // Generate: node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
  SLACK_TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'SLACK_TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
    .optional(),

  // How many days to keep PromptLog / DecisionReasoning rows (default 60).
  RETENTION_DAYS: z.coerce.number().int().min(1).default(60),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export const validateEnv = (): AppEnv => {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(
      `\n[env] Invalid environment configuration — fix these before starting:\n${issues}\n`
    );
  }

  const env = result.data;

  if (!env.FIREBASE_PRIVATE_KEY && !env.FIREBASE_PRIVATE_KEY_B64) {
    throw new Error(
      '\n[env] Invalid environment configuration — fix these before starting:\n' +
      '  • FIREBASE_PRIVATE_KEY or FIREBASE_PRIVATE_KEY_B64: one must be set\n'
    );
  }

  // Additional validations for production safety
  if (env.NODE_ENV === 'production') {
    // Slack integration must be fully configured in production
    const hasSlackIntegration = 
      process.env.SLACK_CLIENT_ID || 
      process.env.SLACK_CLIENT_SECRET || 
      process.env.SLACK_SIGNING_SECRET;
    
    if (hasSlackIntegration) {
      const slackMissing = [];
      if (!process.env.SLACK_CLIENT_ID) slackMissing.push('SLACK_CLIENT_ID');
      if (!process.env.SLACK_CLIENT_SECRET) slackMissing.push('SLACK_CLIENT_SECRET');
      if (!process.env.SLACK_REDIRECT_URI) slackMissing.push('SLACK_REDIRECT_URI');
      if (!process.env.SLACK_SIGNING_SECRET) slackMissing.push('SLACK_SIGNING_SECRET');
      if (!process.env.SLACK_TOKEN_ENCRYPTION_KEY) slackMissing.push('SLACK_TOKEN_ENCRYPTION_KEY');
      
      if (slackMissing.length > 0) {
        throw new Error(
          `[env] Slack integration partially configured in production. Set all or none: ${slackMissing.join(', ')}`
        );
      }
    }
  }

  cached = env;
  return cached;
};
