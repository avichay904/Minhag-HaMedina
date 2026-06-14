import { CHALLENGE_PARAMS, RANK_ORDER } from '../constants.js';
import { Rank } from '../enums.js';

export interface ChallengeTargetInput {
  /** N — number of active questions this week. */
  activeQuestionCount: number;
  /** Average questions answered per week (community or personal baseline). */
  avgPerWeek: number;
  /** Respondent rank — drives the difficulty bonus. */
  rank: Rank;
}

/** Steps a rank sits above BEGINNER (GUEST/BEGINNER => 0). */
export function rankStepsAboveBeginner(rank: Rank): number {
  const beginnerIdx = RANK_ORDER.indexOf(Rank.BEGINNER);
  const idx = RANK_ORDER.indexOf(rank);
  return Math.max(0, idx - beginnerIdx);
}

/**
 * Auto-generate the weekly challenge target (SRS §5.3):
 *   base    = min(N, max(3, round(avgPerWeek × 1.1)))
 *   bonus   = +10% per rank above Beginner
 *   ceiling = floor(0.8 × N)   (never more than 80% of the week's questions)
 *   target  = min(round(base × bonus), ceiling, N)
 */
export function computeChallengeTarget(input: ChallengeTargetInput): number {
  const { activeQuestionCount: N, avgPerWeek, rank } = input;
  if (N <= 0) return 0;

  const base = Math.min(N, Math.max(CHALLENGE_PARAMS.minTarget, Math.round(avgPerWeek * CHALLENGE_PARAMS.avgMultiplier)));
  const multiplier = 1 + CHALLENGE_PARAMS.rankBonusPerStep * rankStepsAboveBeginner(rank);
  const withBonus = Math.round(base * multiplier);
  const ceiling = Math.floor(CHALLENGE_PARAMS.ceilingRatio * N);

  // N > 0 here (early-return above). Guarantee a meaningful target of at least 1
  // so a tiny week (e.g. N=1, where 80% ceiling floors to 0) never disables the
  // weekly challenge / gamification entirely.
  return Math.max(1, Math.min(withBonus, ceiling, N));
}

export interface ChallengeReward {
  badge: 'CHALLENGE_OF_WEEK' | 'ALMOST' | null;
  bonusPoints: number;
}

/** Reward for a respondent's progress against the weekly challenge target. */
export function challengeReward(countAnswered: number, target: number): ChallengeReward {
  if (target <= 0) return { badge: null, bonusPoints: 0 };
  if (countAnswered >= target) {
    return { badge: 'CHALLENGE_OF_WEEK', bonusPoints: CHALLENGE_PARAMS.fullCompletionBonus };
  }
  if (countAnswered / target >= CHALLENGE_PARAMS.almostThreshold) {
    return { badge: 'ALMOST', bonusPoints: CHALLENGE_PARAMS.almostBonus };
  }
  return { badge: null, bonusPoints: 0 };
}
