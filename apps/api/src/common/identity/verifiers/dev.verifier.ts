import { Injectable } from '@nestjs/common';
import { AuthProvider } from '@mhm/shared';
import type { IdentityResult } from '../identity.types';

/**
 * Development verifier — accepts a signed dev token so the full auth + Trust Score
 * flow can be exercised without real OAuth secrets (IDENTITY_MODE=dev).
 *
 * Token format: `dev:<externalId>[:<email>[:<name>]]`  (or any opaque string => externalId).
 */
@Injectable()
export class DevVerifier {
  async verify(token: string, provider: AuthProvider): Promise<IdentityResult> {
    if (token.startsWith('dev:')) {
      const [, externalId, email, name] = token.split(':');
      return { provider, externalId: externalId || 'dev-user', email, name };
    }
    return { provider, externalId: token, email: `${token}@dev.local` };
  }
}
