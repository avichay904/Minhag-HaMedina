import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createVerify } from 'node:crypto';
import { AuthProvider } from '@mhm/shared';
import type { IdentityResult } from '../identity.types';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
/** Cache Apple JWKS for 1 hour (keys rotate rarely). */
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Live Apple verifier.
 * Validates an Apple identity token (JWT) against Apple's public JWKS:
 *  1. Parse the token header to find the key id (kid).
 *  2. Fetch / cache Apple's JWKS.
 *  3. Verify the RS256 signature using the matching public key.
 *  4. Assert: iss = https://appleid.apple.com, aud = APPLE_CLIENT_ID, not expired.
 */
@Injectable()
export class AppleVerifier {
  private readonly logger = new Logger(AppleVerifier.name);
  private readonly clientId: string;

  /** Simple in-process JWKS cache. */
  private cachedKeys: AppleJwk[] = [];
  private keyCachedAt = 0;

  constructor(private readonly config: ConfigService) {
    this.clientId = this.config.get<string>('apple.clientId') ?? '';
  }

  async verify(token: string): Promise<IdentityResult> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Apple token is not a valid JWT');
    }

    // Decode header + payload (no signature check yet)
    let header: JwtHeader;
    let payload: AppleJwtPayload;
    try {
      header = JSON.parse(bufferB64Url(parts[0])) as JwtHeader;
      payload = JSON.parse(bufferB64Url(parts[1])) as AppleJwtPayload;
    } catch {
      throw new UnauthorizedException('Apple token header/payload could not be decoded');
    }

    // Validate claims before doing expensive crypto
    this.assertClaims(payload);

    // Find the matching JWK, then verify the signature
    const jwk = await this.findKey(header.kid);
    const publicKeyPem = jwkToPem(jwk);
    const signingInput = `${parts[0]}.${parts[1]}`;
    const signatureBuffer = Buffer.from(parts[2], 'base64url');

    let valid: boolean;
    try {
      const verifier = createVerify('RSA-SHA256');
      verifier.update(signingInput);
      valid = verifier.verify(publicKeyPem, signatureBuffer);
    } catch (err) {
      throw new UnauthorizedException(
        `Apple token signature verification error: ${(err as Error).message}`,
      );
    }

    if (!valid) {
      throw new UnauthorizedException('Apple token signature is invalid');
    }

    return {
      provider: AuthProvider.APPLE,
      externalId: payload.sub,
      email: payload.email,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private assertClaims(payload: AppleJwtPayload): void {
    if (payload.iss !== APPLE_ISSUER) {
      throw new UnauthorizedException(
        `Apple token issuer mismatch: expected ${APPLE_ISSUER}, got ${payload.iss}`,
      );
    }
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (this.clientId && !aud.includes(this.clientId)) {
      throw new UnauthorizedException(
        `Apple token audience mismatch: expected ${this.clientId}`,
      );
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSec) {
      throw new UnauthorizedException('Apple token has expired');
    }
  }

  private async findKey(kid: string | undefined): Promise<AppleJwk> {
    const keys = await this.getKeys();

    // If no kid in token header, fall back to single-key JWKS
    if (!kid) {
      if (keys.length === 1) return keys[0];
      throw new UnauthorizedException('Apple token has no kid and JWKS has multiple keys');
    }

    // Try exact kid match
    const match = keys.find((k) => k.kid === kid);
    if (match) return match;

    // Refresh once and retry (key rotation)
    this.keyCachedAt = 0;
    const freshKeys = await this.getKeys();
    const freshMatch = freshKeys.find((k) => k.kid === kid);
    if (freshMatch) return freshMatch;

    throw new UnauthorizedException(
      `Apple JWKS: no key found for kid=${kid}`,
    );
  }

  private async getKeys(): Promise<AppleJwk[]> {
    if (this.cachedKeys.length > 0 && Date.now() - this.keyCachedAt < JWKS_CACHE_TTL_MS) {
      return this.cachedKeys;
    }

    try {
      const res = await fetch(APPLE_JWKS_URL);
      if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
      const data = (await res.json()) as { keys: AppleJwk[] };
      this.cachedKeys = data.keys;
      this.keyCachedAt = Date.now();
      return this.cachedKeys;
    } catch (err) {
      this.logger.error('[AppleVerifier] Failed to fetch Apple JWKS', err);
      throw new UnauthorizedException('Could not fetch Apple public keys');
    }
  }
}

// -------------------------------------------------------------------------
// JWK → PEM conversion (RSA only, modulus + exponent)
// -------------------------------------------------------------------------

interface AppleJwk {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string; // base64url-encoded modulus
  e: string; // base64url-encoded exponent
}

interface JwtHeader {
  alg: string;
  kid?: string;
}

interface AppleJwtPayload {
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  sub: string;
  email?: string;
}

/**
 * Convert an RSA JWK to a PEM-encoded public key that Node's `crypto.createVerify` accepts.
 * This is a minimal DER/PEM encoder — handles only RSA keys (which Apple always uses).
 */
function jwkToPem(jwk: AppleJwk): string {
  if (jwk.kty !== 'RSA') {
    throw new Error(`Unsupported key type: ${jwk.kty}`);
  }

  const n = base64urlToBuffer(jwk.n);
  const e = base64urlToBuffer(jwk.e);

  // Build a DER-encoded RSAPublicKey (PKCS#1):
  // SEQUENCE { INTEGER (modulus), INTEGER (exponent) }
  const pkcs1 = derSequence([derInteger(n), derInteger(e)]);

  // Wrap in SubjectPublicKeyInfo (SPKI) — required by Node's crypto:
  // SEQUENCE { SEQUENCE { OID rsaEncryption, NULL }, BIT STRING { pkcs1 } }
  const rsaOid = Buffer.from('300d06092a864886f70d0101010500', 'hex'); // OID 1.2.840.113549.1.1.1 + NULL
  const spki = derSequence([rsaOid, derBitString(pkcs1)]);

  const b64 = spki.toString('base64').replace(/.{64}/g, '$&\n');
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----\n`;
}

function base64urlToBuffer(b64url: string): Buffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function bufferB64Url(b64url: string): string {
  return Buffer.from(b64url, 'base64url').toString('utf8');
}

/** Encode a buffer as a DER INTEGER, prepending 0x00 if the high bit is set. */
function derInteger(buf: Buffer): Buffer {
  // Strip leading zeros but keep at least one byte
  let start = 0;
  while (start < buf.length - 1 && buf[start] === 0) start++;
  const value = buf.subarray(start);
  // Prepend 0x00 if high bit is set (to keep it positive)
  const needsPad = (value[0] & 0x80) !== 0;
  const content = needsPad ? Buffer.concat([Buffer.from([0x00]), value]) : value;
  return Buffer.concat([Buffer.from([0x02]), derLength(content.length), content]);
}

/** Encode as DER SEQUENCE. */
function derSequence(items: Buffer[]): Buffer {
  const content = Buffer.concat(items);
  return Buffer.concat([Buffer.from([0x30]), derLength(content.length), content]);
}

/** Encode as DER BIT STRING (prepend 0x00 for unused bits count). */
function derBitString(data: Buffer): Buffer {
  const content = Buffer.concat([Buffer.from([0x00]), data]);
  return Buffer.concat([Buffer.from([0x03]), derLength(content.length), content]);
}

/** Encode a DER length (supports lengths up to 2^16). */
function derLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x100) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}
