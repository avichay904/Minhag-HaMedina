export interface AppConfig {
  port: number;
  apiPrefix: string;
  jwt: { secret: string; expiresIn: string };
  adminToken: string;
  identityMode: 'dev' | 'live';
  google: { clientId: string };
  apple: { clientId: string };
  rateLimit: { ttlSec: number; max: number };
  fcm: {
    projectId: string | undefined;
    serverKey: string | undefined;
    serviceAccount: string | undefined;
  };
  pow: {
    enabled: boolean;
    difficulty: number;
    secret: string | undefined;
  };
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
  fcm: {
    projectId: process.env.FCM_PROJECT_ID,
    serverKey: process.env.FCM_SERVER_KEY,
    serviceAccount: process.env.FCM_SERVICE_ACCOUNT,
  },
  pow: {
    enabled: process.env.POW_ENABLED === 'true',
    difficulty: parseInt(process.env.POW_DIFFICULTY ?? '4', 10),
    secret: process.env.POW_SECRET,
  },
});
