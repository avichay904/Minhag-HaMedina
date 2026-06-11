import { createHash, randomBytes } from 'node:crypto';

/** Deterministic SHA-256 hex hash — used to store external-source API keys. */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Generate a fresh random API key (returned once to the source operator). */
export function generateApiKey(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
