import { z } from 'zod';

const DEV_JWT_DEFAULT = 'dev-super-secret-change-me';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.string().optional().default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('api/v1'),
  JWT_SECRET: z.string().min(1).default(DEV_JWT_DEFAULT),
  JWT_EXPIRES_IN: z.string().default('30d'),
  ADMIN_API_TOKEN: z.string().default('dev-admin-token'),
  IDENTITY_MODE: z.enum(['dev', 'live']).default('dev'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  APPLE_CLIENT_ID: z.string().optional().default(''),
  RATE_LIMIT_TTL_SEC: z.coerce.number().default(60),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  // Push notification (FCM) — all optional; absence disables FCM sender.
  FCM_PROJECT_ID: z.string().optional(),
  FCM_SERVER_KEY: z.string().optional(),
  FCM_SERVICE_ACCOUNT: z.string().optional(),
  // Proof-of-Work anti-bot — all optional; disabled by default.
  POW_ENABLED: z.string().optional().default('false'),
  POW_DIFFICULTY: z.coerce.number().int().min(1).max(8).optional().default(4),
  POW_SECRET: z.string().optional(),
  // CORS — comma-separated origin allowlist; required in production.
  CORS_ORIGINS: z.string().optional(),
  // File uploads — optional; defaults set in configuration.ts.
  UPLOADS_DIR: z.string().optional(),
  PUBLIC_BASE_URL: z.string().optional(),
});

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }

  const data = parsed.data;

  // Production safety: reject weak JWT secret.
  if (data.NODE_ENV === 'production') {
    if (!data.JWT_SECRET || data.JWT_SECRET === DEV_JWT_DEFAULT) {
      throw new Error(
        'JWT_SECRET must be set to a strong random value in production (not the dev default).',
      );
    }
  }

  return data;
}
