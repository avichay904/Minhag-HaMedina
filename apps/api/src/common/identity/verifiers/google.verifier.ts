import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthProvider } from '@mhm/shared';
import type { IdentityResult } from '../identity.types';

/** Live Google verifier — validates an id_token via Google's tokeninfo endpoint. */
@Injectable()
export class GoogleVerifier {
  async verify(token: string): Promise<IdentityResult> {
    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error(`tokeninfo ${res.status}`);
      const data = (await res.json()) as { sub?: string; email?: string; name?: string };
      if (!data.sub) throw new Error('missing sub');
      return { provider: AuthProvider.GOOGLE, externalId: data.sub, email: data.email, name: data.name };
    } catch (err) {
      throw new UnauthorizedException(`Invalid Google token: ${(err as Error).message}`);
    }
  }
}
