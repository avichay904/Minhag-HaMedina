import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('hashPassword', () => {
  it('returns a string in scrypt$salt$hash format', async () => {
    const hash = await hashPassword('my-password');
    const parts = hash.split('$');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('scrypt');
    // salt: 16 bytes → 32 hex chars
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    // hash: 64 bytes → 128 hex chars
    expect(parts[2]).toMatch(/^[0-9a-f]{128}$/);
  });

  it('does not return the plaintext password', async () => {
    const plain = 'super-secret';
    const hash = await hashPassword(plain);
    expect(hash).not.toContain(plain);
  });

  it('produces different hashes for the same input (unique salts)', async () => {
    const [h1, h2] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(h1).not.toBe(h2);
    // Salts must differ
    expect(h1.split('$')[1]).not.toBe(h2.split('$')[1]);
  });
});

describe('verifyPassword', () => {
  it('returns true for the correct plaintext', async () => {
    const plain = 'correct-horse-battery';
    const stored = await hashPassword(plain);
    await expect(verifyPassword(plain, stored)).resolves.toBe(true);
  });

  it('returns false for a wrong plaintext', async () => {
    const stored = await hashPassword('right-password');
    await expect(verifyPassword('wrong-password', stored)).resolves.toBe(false);
  });

  it('returns false for a malformed stored value', async () => {
    await expect(verifyPassword('any', 'not-a-valid-hash')).resolves.toBe(false);
    await expect(verifyPassword('any', 'scrypt$onlytwoparts')).resolves.toBe(false);
    await expect(verifyPassword('any', '')).resolves.toBe(false);
  });

  it('returns false for wrong prefix', async () => {
    const stored = await hashPassword('pass');
    const tampered = stored.replace('scrypt$', 'bcrypt$');
    await expect(verifyPassword('pass', tampered)).resolves.toBe(false);
  });
});
