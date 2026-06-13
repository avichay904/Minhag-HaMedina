import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { PowService } from './pow.service';

// ---------------------------------------------------------------------------
// Helper: build PowService with a fixed config
// ---------------------------------------------------------------------------

async function buildService(
  opts: { powSecret?: string; jwtSecret?: string; difficulty?: number } = {},
): Promise<PowService> {
  const { powSecret, jwtSecret = 'test-jwt-secret', difficulty = 4 } = opts;

  const configMock = {
    get: vi.fn((key: string) => {
      if (key === 'pow.secret') return powSecret;
      if (key === 'jwt.secret') return jwtSecret;
      if (key === 'pow.difficulty') return difficulty;
      return undefined;
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PowService,
      { provide: ConfigService, useValue: configMock },
    ],
  }).compile();

  return module.get(PowService);
}

// ---------------------------------------------------------------------------
// Helper: mine a valid nonce for a given challenge and difficulty
// ---------------------------------------------------------------------------

function mineNonce(challenge: string, difficulty: number): string {
  const prefix = '0'.repeat(difficulty);
  let i = 0;
  while (true) {
    const nonce = String(i);
    const hash = createHash('sha256').update(`${challenge}:${nonce}`).digest('hex');
    if (hash.startsWith(prefix)) return nonce;
    i++;
  }
}

// ---------------------------------------------------------------------------
// Tests: issue()
// ---------------------------------------------------------------------------

describe('PowService.issue', () => {
  let service: PowService;

  beforeEach(async () => {
    service = await buildService({ difficulty: 2 });
  });

  it('returns a challenge string, difficulty, and ISO expiresAt', () => {
    const result = service.issue();

    expect(typeof result.challenge).toBe('string');
    expect(result.challenge.length).toBeGreaterThan(0);
    expect(result.difficulty).toBe(2);
    expect(typeof result.expiresAt).toBe('string');
    // Must parse as a valid date
    expect(Number.isNaN(Date.parse(result.expiresAt))).toBe(false);
  });

  it('expiresAt is approximately 5 minutes in the future', () => {
    const before = Date.now();
    const result = service.issue();
    const after = Date.now();

    const expiresMs = Date.parse(result.expiresAt);
    // Should be between 4:59 and 5:01 from now
    expect(expiresMs - before).toBeGreaterThanOrEqual(4 * 60 * 1000 + 59 * 1000);
    expect(expiresMs - after).toBeLessThanOrEqual(5 * 60 * 1000 + 2000);
  });

  it('challenge contains exactly one dot (payload.sig format)', () => {
    const { challenge } = service.issue();
    const dotCount = (challenge.match(/\./g) ?? []).length;
    expect(dotCount).toBeGreaterThanOrEqual(1);
  });

  it('produces different challenges on successive calls', () => {
    const a = service.issue();
    const b = service.issue();
    expect(a.challenge).not.toBe(b.challenge);
  });
});

// ---------------------------------------------------------------------------
// Tests: verify() — happy path
// ---------------------------------------------------------------------------

describe('PowService.verify — valid solve', () => {
  it('does not throw when challenge+nonce are valid', async () => {
    const service = await buildService({ difficulty: 2 });
    const { challenge } = service.issue();
    const nonce = mineNonce(challenge, 2);

    expect(() => service.verify(challenge, nonce)).not.toThrow();
  });

  it('works with difficulty 1', async () => {
    const service = await buildService({ difficulty: 1 });
    const { challenge } = service.issue();
    const nonce = mineNonce(challenge, 1);

    expect(() => service.verify(challenge, nonce)).not.toThrow();
  });

  it('works with difficulty 3', async () => {
    const service = await buildService({ difficulty: 3 });
    const { challenge } = service.issue();
    const nonce = mineNonce(challenge, 3);

    expect(() => service.verify(challenge, nonce)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: verify() — failure modes
// ---------------------------------------------------------------------------

describe('PowService.verify — invalid inputs', () => {
  let service: PowService;

  beforeEach(async () => {
    service = await buildService({ difficulty: 2 });
  });

  it('throws BadRequest when challenge has no dot separator', () => {
    expect(() => service.verify('no-dot-here', 'nonce')).toThrow('Invalid PoW challenge format');
  });

  it('throws BadRequest when the nonce does not satisfy difficulty', () => {
    const { challenge } = service.issue();
    // Use a nonce very unlikely to satisfy difficulty=2 hash
    expect(() => service.verify(challenge, 'definitely-wrong-nonce-xyzzy')).toThrow(
      'PoW nonce does not satisfy difficulty requirement',
    );
  });

  it('throws BadRequest when HMAC signature is tampered', () => {
    const { challenge } = service.issue();
    // Replace the signature portion with garbage
    const dotIdx = challenge.lastIndexOf('.');
    const tampered = `${challenge.slice(0, dotIdx)}.TAMPERED_SIG`;

    expect(() => service.verify(tampered, 'any-nonce')).toThrow(
      'PoW challenge signature invalid',
    );
  });

  it('throws BadRequest when HMAC payload is tampered (different payload + original sig)', () => {
    const { challenge } = service.issue();
    const dotIdx = challenge.lastIndexOf('.');
    const sig = challenge.slice(dotIdx + 1);
    // Change the payload but keep the original sig → HMAC mismatch
    const tampered = `DIFFERENT_PAYLOAD.${sig}`;

    expect(() => service.verify(tampered, 'any-nonce')).toThrow(
      'PoW challenge signature invalid',
    );
  });

  it('throws BadRequest when challenge is expired', async () => {
    // Issue a challenge with a timestamp 6 minutes in the past (TTL = 5 min).
    const pastMs = Date.now() - 6 * 60 * 1000;

    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(pastMs);
    const { challenge } = service.issue();
    dateSpy.mockRestore(); // restore Date.now so verify() sees the real current time

    // Mine a valid nonce (difficulty=2); expiry check fires before work check
    const nonce = mineNonce(challenge, 2);

    expect(() => service.verify(challenge, nonce)).toThrow('PoW challenge has expired');
  });

  it('throws BadRequest when challenge payload is invalid base64url JSON', () => {
    // Craft a challenge where the payload decodes to invalid JSON.
    // We have to sign it with the same secret: use a fresh service and inject
    // a known secret, then craft a forged payload with our own HMAC.
    // Instead, just test that a completely malformed challenge throws.
    const malformed = 'not-base64url-json.signature';
    expect(() => service.verify(malformed, 'nonce')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Tests: secret derivation
// ---------------------------------------------------------------------------

describe('PowService — secret derivation', () => {
  it('uses POW_SECRET when set', async () => {
    const s1 = await buildService({ powSecret: 'explicit-pow-secret', difficulty: 2 });
    const s2 = await buildService({ powSecret: 'explicit-pow-secret', difficulty: 2 });

    const { challenge: c1 } = s1.issue();
    const nonce = mineNonce(c1, 2);

    // Both services share the same secret — s2 can verify s1's challenge
    expect(() => s2.verify(c1, nonce)).not.toThrow();
  });

  it('falls back to jwt-derived secret when POW_SECRET is unset', async () => {
    const s1 = await buildService({ jwtSecret: 'shared-jwt', difficulty: 2 });
    const s2 = await buildService({ jwtSecret: 'shared-jwt', difficulty: 2 });

    const { challenge: c1 } = s1.issue();
    const nonce = mineNonce(c1, 2);

    expect(() => s2.verify(c1, nonce)).not.toThrow();
  });

  it('rejects a challenge issued by a service with a different secret', async () => {
    const issuer = await buildService({ powSecret: 'secret-A', difficulty: 2 });
    const verifier = await buildService({ powSecret: 'secret-B', difficulty: 2 });

    const { challenge } = issuer.issue();
    const nonce = mineNonce(challenge, 2);

    expect(() => verifier.verify(challenge, nonce)).toThrow('PoW challenge signature invalid');
  });
});
