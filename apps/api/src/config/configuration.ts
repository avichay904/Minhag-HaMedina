export interface AppConfig {
  port: number;
  apiPrefix: string;
  jwt: { secret: string; expiresIn: string };
  adminToken: string;
  identityMode: 'dev' | 'live';
  google: { clientId: string };
  apple: { clientId: string };
  rateLimit: { ttlSec: number; max: number };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-super-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  },
  adminToken: process.env.ADMIN_API_TOKEN ?? 'dev-admin-token',
  identityMode: (process.env.IDENTITY_MODE as 'dev' | 'live') ?? 'dev',
  google: { clientId: process.env.GOOGLE_CLIENT_ID ?? '' },
  apple: { clientId: process.env.APPLE_CLIENT_ID ?? '' },
  rateLimit: {
    ttlSec: parseInt(process.env.RATE_LIMIT_TTL_SEC ?? '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '120', 10),
  },
});
