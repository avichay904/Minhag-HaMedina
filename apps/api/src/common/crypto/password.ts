/**
 * Password hashing/verification using Node's built-in `crypto.scrypt`.
 * No extra dependencies required.
 *
 * Stored format: `scrypt$<saltHex>$<hashHex>`
 *
 * Parameters are chosen to be memory-hard while remaining fast enough for
 * low-frequency admin logins (N=16384, r=8, p=1 — OWASP recommended minimum).
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

/** Wraps scrypt callback into a Promise while passing ScryptOptions. */
function scryptPromise(password: string, salt: Buffer, keyLen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLen, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Hash a plaintext password. Returns a self-contained string that includes the
 * salt, so no separate salt storage is needed.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptPromise(plaintext, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Verify a plaintext password against a stored hash produced by `hashPassword`.
 * Returns `true` if the password matches, `false` otherwise.
 * Uses a constant-time comparison to prevent timing attacks.
 */
export async function verifyPassword(plaintext: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const [, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');

  try {
    const actualHash = await scryptPromise(plaintext, salt, KEY_LENGTH);
    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}
