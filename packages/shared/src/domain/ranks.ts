import { RANK_ORDER, RANK_THRESHOLDS } from '../constants.js';
import { Rank } from '../enums.js';
import type { RankProgress } from '../types.js';

export interface RankStats {
  surveysCompleted: number;
  trustScore: number;
}

/**
 * Highest rank a respondent qualifies for given completed surveys + trust score (SRS §5.1).
 * Both thresholds must be met; otherwise we fall back down the ladder.
 */
export function rankForStats(stats: RankStats): Rank {
  let result: Rank = Rank.GUEST;
  for (const rank of RANK_ORDER) {
    const t = RANK_THRESHOLDS[rank];
    if (stats.surveysCompleted >= t.minSurveys && stats.trustScore >= t.minTrust) {
      result = rank;
    }
  }
  return result;
}

export function nextRank(rank: Rank): Rank | null {
  const idx = RANK_ORDER.indexOf(rank);
  return idx >= 0 && idx < RANK_ORDER.length - 1 ? RANK_ORDER[idx + 1] : null;
}

/** Current rank + what it takes to reach the next one. */
export function rankProgress(stats: RankStats): RankProgress {
  const current = rankForStats(stats);
  const next = nextRank(current);
  if (!next) {
    return { current, next: null, surveysToNext: null, trustBlockedNext: false };
  }
  const t = RANK_THRESHOLDS[next];
  const surveysToNext = Math.max(0, t.minSurveys - stats.surveysCompleted);
  const trustBlockedNext = stats.trustScore < t.minTrust;
  return { current, next, surveysToNext, trustBlockedNext };
}
