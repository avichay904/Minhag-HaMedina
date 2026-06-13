import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash } from 'node:crypto';
import type { PowChallengeResponse } from '@mhm/contracts';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class PowService {
  private readonly secret: string;
  private readonly difficulty: number;

  constructor(private readonly config: ConfigService) {
    // Derive secret from POW_SECRET; fall back to JWT secret so nothing is
    // truly secret-less in all environments.
    const powSecret = this.config.get<string>('pow.secret');
    const jwtSecret = this.config.get<string>('jwt.secret') ?? 'dev-super-secret-change-me';
    this.secret = powSecret ?? `pow:${jwtSecret}`;
    this.difficulty = this.config.get<number>('pow.difficulty') ?? 4;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Issue a stateless PoW challenge. */
  issue(): PowChallengeResponse {
    const nonce = createHash('sha256')
      .update(`${Date.now()}:${Math.random()}`)
      .digest('base64url')
      .slice(0, 16);

    const ts = Date.now();
    const payload = this.buildPayload(nonce, ts);
    const sig = this.sign(payload);
    const challenge = `${payload}.${sig}`;
    const expiresAt = new Date(ts + CHALLENGE_TTL_MS).toISOString();

    return { challenge, difficulty: this.difficulty, expiresAt };
  }

  /**
   * Verify that a (challenge, nonce) pair is valid:
   *  1. HMAC signature matches (tamper-proof)
   *  2. Challenge has not expired (≤ 5 min)
   *  3. sha256(`${challenge}:${nonce}`) has `difficulty` leading zero HEX chars
   */
  verify(challenge: string, nonce: string): void {
    const dotIdx = challenge.lastIndexOf('.');
    if (dotIdx === -1) {
      throw new BadRequestException('Invalid PoW challenge format');
    }
    const payload = challenge.slice(0, dotIdx);
    const sig = challenge.slice(dotIdx + 1);

    // 1. Verify HMAC
    const expectedSig = this.sign(payload);
    if (!timingSafeEqual(sig, expectedSig)) {
      throw new BadRequestException('PoW challenge signature invalid');
    }

    // 2. Verify expiry — payload is base64url(JSON{nonce, ts})
    let ts: number;
    try {
      const decoded = Buffer.from(payload, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as { ts: number };
      ts = parsed.ts;
    } catch {
      throw new BadRequestException('PoW challenge payload malformed');
    }

    if (Date.now() - ts > CHALLENGE_TTL_MS) {
      throw new BadRequestException('PoW challenge has expired');
    }

    // 3. Verify work: sha256(`${challenge}:${nonce}`) must start with `difficulty` zero HEX chars
    const workHash = createHash('sha256')
      .update(`${challenge}:${nonce}`)
      .digest('hex');

    const required = '0'.repeat(this.difficulty);
    if (!workHash.startsWith(required)) {
      throw new BadRequestException('PoW nonce does not satisfy difficulty requirement');
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private buildPayload(nonce: string, ts: number): string {
    return Buffer.from(JSON.stringify({ nonce, ts })).toString('base64url');
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
}

/** Constant-time string comparison to avoid timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // Node's crypto.timingSafeEqual requires equal-length buffers
  return require('node:crypto').timingSafeEqual(bufA, bufB);
}
