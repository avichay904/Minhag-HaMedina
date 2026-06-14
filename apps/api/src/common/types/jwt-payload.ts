import type { AuthProvider } from '@mhm/shared';

/** Claims embedded in respondent JWTs issued by the auth/external modules. */
export interface JwtPayload {
  sub: string; // respondent id
  type: 'respondent' | 'admin';
  authProvider?: AuthProvider;
  trustScore: number;
  sourceId?: string;
}
