import { ANONYMOUS_TRUST, DEFAULT_MIN_TRUST } from '../constants.js';
import type { RespondentContext, Targeting } from '../types.js';

/**
 * Does the targeting profile carry any *demographic* constraint?
 * (A pure min-trust gate is NOT demographic targeting — it is a participation gate
 * that also applies to general questions.)
 */
export function hasDemographicTargeting(t: Targeting): boolean {
  return (
    t.ageMin != null ||
    t.ageMax != null ||
    (t.gender != null && t.gender !== 'ALL') ||
    (t.regions != null && t.regions.length > 0) ||
    (t.language != null && t.language !== 'ALL')
  );
}

/**
 * Decide whether a question with the given targeting should be shown to a respondent.
 *
 * Rules (SRS §3.3):
 *  - The min-trust gate always applies.
 *  - General (non-demographically-targeted) questions are shown to everyone who passes the gate.
 *  - Demographically targeted questions are NEVER shown to anonymous (0.4) users.
 *  - For identified users, every set demographic axis must match.
 */
export function matchesTargeting(t: Targeting, ctx: RespondentContext): boolean {
  const minTrust = t.minTrustScore ?? DEFAULT_MIN_TRUST;
  if (ctx.trustScore < minTrust) return false;

  if (!hasDemographicTargeting(t)) return true;

  // Demographically targeted → anonymous users never see it.
  if (ctx.trustScore <= ANONYMOUS_TRUST) return false;

  // Age
  if (t.ageMin != null || t.ageMax != null) {
    if (ctx.age == null) return false;
    if (t.ageMin != null && ctx.age < t.ageMin) return false;
    if (t.ageMax != null && ctx.age > t.ageMax) return false;
  }

  // Gender
  if (t.gender != null && t.gender !== 'ALL') {
    if (ctx.gender !== t.gender) return false;
  }

  // Region
  if (t.regions != null && t.regions.length > 0) {
    if (ctx.region == null || !t.regions.includes(ctx.region)) return false;
  }

  // Language
  if (t.language != null && t.language !== 'ALL') {
    if (ctx.language !== t.language) return false;
  }

  return true;
}
