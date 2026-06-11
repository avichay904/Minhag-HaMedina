import { ALL_CATEGORIES } from '../enums.js';
import { BADGE_RULES } from '../constants.js';
import { BadgeType } from '../enums.js';
import type { BadgeStats } from '../types.js';

/**
 * Evaluate which badges a respondent currently qualifies for (SRS §5.2).
 * Returns the full set of earned badge types; callers persist the deltas.
 */
export function evaluateBadges(stats: BadgeStats): BadgeType[] {
  const earned: BadgeType[] = [];

  if (stats.consecutiveWeeks >= BADGE_RULES.streakWeeks) {
    earned.push(BadgeType.STREAK);
  }
  if (stats.avgAnswerTimeSec != null && stats.avgAnswerTimeSec < BADGE_RULES.fastMaxAvgSeconds) {
    earned.push(BadgeType.FAST);
  }
  if (hasAllCategories(stats.categoriesAnswered)) {
    earned.push(BadgeType.DIVERSE);
  }
  if (stats.weeklyChallengesCompleted >= BADGE_RULES.challengeCount) {
    earned.push(BadgeType.CHALLENGE);
  }
  if (stats.currentChallengeCompleted) {
    earned.push(BadgeType.CHALLENGE_OF_WEEK);
  } else if (
    stats.currentChallengeRatio != null &&
    stats.currentChallengeRatio >= BADGE_RULES.almostRatio
  ) {
    earned.push(BadgeType.ALMOST);
  }

  return earned;
}

function hasAllCategories(answered: BadgeStats['categoriesAnswered']): boolean {
  const set = new Set(answered);
  return ALL_CATEGORIES.every((c) => set.has(c));
}
