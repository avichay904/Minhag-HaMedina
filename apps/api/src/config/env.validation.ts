import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('api/v1'),
  JWT_SECRET: z.string().min(1).default('dev-super-secret-change-me'),
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
});

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }
  return parsed.data;
}
