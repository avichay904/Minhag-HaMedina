/**
 * Client-side Proof-of-Work solver using Web Crypto (SHA-256).
 *
 * The server issues a challenge string and a difficulty (number of leading
 * hex '0' chars required).  We find a nonce (string) such that:
 *
 *   SHA-256(`${challenge}:${nonce}`)  starts with `difficulty` '0' hex chars.
 *
 * Returns null if the cap is hit (caller must treat this as "no PoW available"
 * and fall back to a plain anonymous-login request).
 */

const MAX_ITERATIONS = 5_000_000;

/**
 * Convert an ArrayBuffer of SHA-256 bytes to a lowercase hex string.
 */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Solve a PoW challenge.
 *
 * @param challenge  The challenge string from the server.
 * @param difficulty Number of leading hex '0' chars required in the hash.
 * @returns          The winning nonce string, or null if MAX_ITERATIONS hit.
 */
export async function solvePoW(
  challenge: string,
  difficulty: number,
): Promise<string | null> {
  const prefix = '0'.repeat(difficulty);
  const encoder = new TextEncoder();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const nonce = i.toString();
    const data = encoder.encode(`${challenge}:${nonce}`);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    if (bufToHex(hashBuf).startsWith(prefix)) {
      return nonce;
    }
  }

  return null;
}
