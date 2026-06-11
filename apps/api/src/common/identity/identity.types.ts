import type { AuthProvider } from '@mhm/shared';

export interface IdentityResult {
  provider: AuthProvider;
  /** Stable subject id from the provider (Google sub, Apple sub, email, …). */
  externalId: string;
  email?: string;
  name?: string;
}

export interface IdentityVerifier {
  verify(token: string): Promise<IdentityResult>;
}
