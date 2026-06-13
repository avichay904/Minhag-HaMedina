import { afterEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, createSign } from 'node:crypto';

import { AppleVerifier } from './apple.verifier';
import { AuthProvider } from '@mhm/shared';

// ---------------------------------------------------------------------------
// Generate a real RSA keypair for test signing.
// We keep it module-level so it's generated once per test file.
// ---------------------------------------------------------------------------

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

/**
 * Export the public key as JWK-compatible n and e (base64url).
 * Node's `publicKey.export({ format: 'jwk' })` returns an object with n, e etc.
 */
const jwkPublic = publicKey.export({ format: 'jwk' }) as { n: string; e: string; kty: string };

const TEST_KID = 'test-key-id-001';

const FAKE_JWKS = {
  keys: [
    {
      kty: 'RSA',
      kid: TEST_KID,
      use: 'sig',
      alg: 'RS256',
      n: jwkPublic.n,
      e: jwkPublic.e,
    },
  ],
};

const APPLE_CLIENT_ID = 'com.example.app';
const APPLE_ISSUER = 'https://appleid.apple.com';

// ---------------------------------------------------------------------------
// Token building helpers
// ---------------------------------------------------------------------------

function b64url(str: string): string {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function buildAppleToken(opts: {
  kid?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  sub?: string;
  email?: string;
  privateKeyOverride?: typeof privateKey;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', kid: opts.kid ?? TEST_KID };
  const payload = {
    iss: opts.iss ?? APPLE_ISSUER,
    aud: opts.aud ?? APPLE_CLIENT_ID,
    exp: opts.exp ?? now + 300,
    iat: now,
    sub: opts.sub ?? 'apple-user-sub-123',
    email: opts.email ?? 'user@privaterelay.appleid.com',
  };

  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = opts.privateKeyOverride ?? privateKey;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const sig = signer.sign(key, 'base64url');
  return `${signingInput}.${sig}`;
}

// ---------------------------------------------------------------------------
// Test setup: build AppleVerifier with mocked ConfigService + mocked fetch
// ---------------------------------------------------------------------------

async function buildVerifier(clientId = APPLE_CLIENT_ID): Promise<AppleVerifier> {
  const configMock = {
    get: vi.fn((key: string) => {
      if (key === 'apple.clientId') return clientId;
      return undefined;
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AppleVerifier,
      { provide: ConfigService, useValue: configMock },
    ],
  }).compile();

  return module.get(AppleVerifier);
}

function stubFetch(jwks = FAKE_JWKS) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => jwks,
    })),
  );
}

// ---------------------------------------------------------------------------
// Tests: happy path
// ---------------------------------------------------------------------------

describe('AppleVerifier.verify — valid token', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns correct IdentityResult for a valid Apple token', async () => {
    stubFetch();
    const verifier = await buildVerifier();
    const token = buildAppleToken({ sub: 'apple-sub-xyz', email: 'alice@example.com' });

    const result = await verifier.verify(token);

    expect(result.provider).toBe(AuthProvider.APPLE);
    expect(result.externalId).toBe('apple-sub-xyz');
    expect(result.email).toBe('alice@example.com');
  });

  it('caches JWKS and does not re-fetch on second verify', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => FAKE_JWKS,
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const verifier = await buildVerifier();
    const token1 = buildAppleToken({});
    const token2 = buildAppleToken({ sub: 'another-sub' });

    await verifier.verify(token1);
    await verifier.verify(token2);

    // fetch should be called exactly once (JWKS cached after first call)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('skips audience check when clientId is empty', async () => {
    stubFetch();
    const verifier = await buildVerifier(''); // empty clientId → skip aud check
    const token = buildAppleToken({ aud: 'com.any.app' });

    await expect(verifier.verify(token)).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: claim validation failures
// ---------------------------------------------------------------------------

describe('AppleVerifier.verify — claim validation failures', () => {
  afterEach(() => vi.restoreAllMocks());

  it('throws UnauthorizedException when iss is wrong', async () => {
    stubFetch();
    const verifier = await buildVerifier();
    const token = buildAppleToken({ iss: 'https://evil.example.com' });

    await expect(verifier.verify(token)).rejects.toThrow('Apple token issuer mismatch');
  });

  it('throws UnauthorizedException when aud does not match clientId', async () => {
    stubFetch();
    const verifier = await buildVerifier();
    const token = buildAppleToken({ aud: 'com.other.app' });

    await expect(verifier.verify(token)).rejects.toThrow('Apple token audience mismatch');
  });

  it('throws UnauthorizedException when token is expired', async () => {
    stubFetch();
    const verifier = await buildVerifier();
    const nowSec = Math.floor(Date.now() / 1000);
    const token = buildAppleToken({ exp: nowSec - 60 }); // expired 60s ago

    await expect(verifier.verify(token)).rejects.toThrow('Apple token has expired');
  });

  it('throws UnauthorizedException for a token with only 2 parts', async () => {
    stubFetch();
    const verifier = await buildVerifier();

    await expect(verifier.verify('header.payload')).rejects.toThrow(
      'Apple token is not a valid JWT',
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: signature validation
// ---------------------------------------------------------------------------

describe('AppleVerifier.verify — signature validation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('throws UnauthorizedException when signed with a different private key', async () => {
    stubFetch(); // JWKS has our test publicKey

    const { privateKey: otherPrivateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const verifier = await buildVerifier();
    const token = buildAppleToken({ privateKeyOverride: otherPrivateKey });

    await expect(verifier.verify(token)).rejects.toThrow(/invalid/i);
  });

  it('throws UnauthorizedException when JWKS has no matching kid', async () => {
    // Return a JWKS with a different kid than the token's
    stubFetch({
      keys: [{ ...FAKE_JWKS.keys[0], kid: 'different-kid' }],
    });

    const verifier = await buildVerifier();
    const token = buildAppleToken({ kid: 'non-existent-kid' });

    await expect(verifier.verify(token)).rejects.toThrow(/no key found/i);
  });

  it('throws UnauthorizedException when JWKS fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );

    const verifier = await buildVerifier();
    const token = buildAppleToken({});

    await expect(verifier.verify(token)).rejects.toThrow('Could not fetch Apple public keys');
  });

  it('throws UnauthorizedException when token signature is tampered', async () => {
    stubFetch();
    const verifier = await buildVerifier();
    const token = buildAppleToken({});
    // Replace the entire signature with a dummy value of the same length
    const parts = token.split('.');
    const sig = parts[2];
    // XOR-flip the first few chars to corrupt the signature reliably
    const corrupted = 'A'.repeat(10) + sig.slice(10);
    const tampered = `${parts[0]}.${parts[1]}.${corrupted}`;

    await expect(verifier.verify(tampered)).rejects.toThrow(/invalid/i);
  });
});
