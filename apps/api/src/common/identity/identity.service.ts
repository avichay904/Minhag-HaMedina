import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '@mhm/shared';
import type { IdentityResult } from './identity.types';
import { DevVerifier } from './verifiers/dev.verifier';
import { GoogleVerifier } from './verifiers/google.verifier';
import { AppleVerifier } from './verifiers/apple.verifier';

/**
 * Resolves a social-login token to a verified identity.
 * In dev mode every provider is verified by the DevVerifier (the resulting
 * Respondent still records the claimed provider, so Trust Score is realistic).
 */
@Injectable()
export class IdentityService {
  constructor(
    private readonly config: ConfigService,
    private readonly dev: DevVerifier,
    private readonly google: GoogleVerifier,
    private readonly apple: AppleVerifier,
  ) {}

  async verify(provider: AuthProvider, token: string): Promise<IdentityResult> {
    const mode = this.config.get<'dev' | 'live'>('identityMode') ?? 'dev';
    if (mode === 'dev') {
      return this.dev.verify(token, provider);
    }
    switch (provider) {
      case AuthProvider.GOOGLE:
        return this.google.verify(token);
      case AuthProvider.APPLE:
        return this.apple.verify(token);
      default:
        return this.dev.verify(token, provider);
    }
  }
}
