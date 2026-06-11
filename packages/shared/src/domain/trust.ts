import { type AuthProvider } from '../enums.js';
import { EXTERNAL_PROVIDERS, TRUST_SCORES } from '../constants.js';

export interface SourceTrustRange {
  trustScoreMin: number;
  trustScoreMax: number;
}

export interface ResolveTrustInput {
  authProvider: AuthProvider;
  /** Registry range for the external source, when the principal came via a source. */
  source?: SourceTrustRange | null;
  /**
   * Optional behavioural modifier in [-x, +x]. Historical good behaviour can nudge up,
   * suspicious behaviour can nudge down. Defaults to 0 (Phase A is deterministic).
   */
  behaviorModifier?: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const isExternal = (provider: AuthProvider): boolean => EXTERNAL_PROVIDERS.includes(provider);

/**
 * Resolve the effective Trust Score for a principal.
 *
 * Trust = f(identity method, arrival source, historical behaviour) — SRS §2.2.
 * For external sources the base score is clamped to the Admin-configured
 * `[trustScoreMin, trustScoreMax]` range of that source.
 */
export function resolveTrustScore(input: ResolveTrustInput): number {
  const base = TRUST_SCORES[input.authProvider];
  let score = base + (input.behaviorModifier ?? 0);

  if (isExternal(input.authProvider) && input.source) {
    score = clamp(score, input.source.trustScoreMin, input.source.trustScoreMax);
  }

  // Never escape the global bounds.
  return Number(clamp(score, 0, 1).toFixed(2));
}
