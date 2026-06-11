import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthProvider } from '@mhm/shared';
import type { IdentityResult } from '../identity.types';

/**
 * Live Apple verifier. Full Sign in with Apple requires validating the identity
 * token against Apple's JWKS; that is wired up alongside real credentials.
 * Until then, live mode fails closed (dev mode is the default for Phase A).
 */
@Injectable()
export class AppleVerifier {
  async verify(_token: string): Promise<IdentityResult> {
    throw new UnauthorizedException('Apple live verification is not configured; use IDENTITY_MODE=dev.');
    return { provider: AuthProvider.APPLE, externalId: '' };
  }
}
