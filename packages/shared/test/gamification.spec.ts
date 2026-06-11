import { describe, expect, it } from 'vitest';
import {
  BadgeType,
  Category,
  Rank,
  canChangeNickname,
  displayName,
  evaluateBadges,
  rankForStats,
  rankProgress,
  validateNickname,
} from '../src/index.js';

describe('rankForStats', () => {
  it('requires BOTH surveys and trust thresholds', () => {
    expect(rankForStats({ surveysCompleted: 0, trustScore: 0.4 })).toBe(Rank.GUEST);
    expect(rankForStats({ surveysCompleted: 3, trustScore: 0.4 })).toBe(Rank.BEGINNER);
    // 10 surveys but only 0.4 trust → cannot reach Contributor (needs 0.7).
    expect(rankForStats({ surveysCompleted: 10, trustScore: 0.4 })).toBe(Rank.BEGINNER);
    expect(rankForStats({ surveysCompleted: 10, trustScore: 0.7 })).toBe(Rank.CONTRIBUTOR);
    expect(rankForStats({ surveysCompleted: 25, trustScore: 0.7 })).toBe(Rank.VETERAN);
    // 50 surveys but 0.7 trust → stays Veteran (Ambassador needs 1.0).
    expect(rankForStats({ surveysCompleted: 50, trustScore: 0.7 })).toBe(Rank.VETERAN);
    expect(rankForStats({ surveysCompleted: 50, trustScore: 1.0 })).toBe(Rank.AMBASSADOR);
  });
});

describe('rankProgress', () => {
  it('reports surveys remaining and trust blocking for the next rank', () => {
    const p = rankProgress({ surveysCompleted: 5, trustScore: 0.4 });
    expect(p.current).toBe(Rank.BEGINNER);
    expect(p.next).toBe(Rank.CONTRIBUTOR);
    expect(p.surveysToNext).toBe(5);
    expect(p.trustBlockedNext).toBe(true);
  });
  it('has no next rank at the top', () => {
    const p = rankProgress({ surveysCompleted: 60, trustScore: 1.0 });
    expect(p.current).toBe(Rank.AMBASSADOR);
    expect(p.next).toBeNull();
  });
});

describe('evaluateBadges', () => {
  it('awards badges per the SRS rules', () => {
    const badges = evaluateBadges({
      consecutiveWeeks: 4,
      avgAnswerTimeSec: 3,
      categoriesAnswered: [
        Category.SOCIETY_POLITICS,
        Category.CONSUMER,
        Category.HEALTH_LIFESTYLE,
        Category.TECHNOLOGY,
        Category.PERSONAL_FINANCE,
        Category.GENERAL,
      ],
      weeklyChallengesCompleted: 5,
      currentChallengeCompleted: true,
    });
    expect(badges).toEqual(
      expect.arrayContaining([
        BadgeType.STREAK,
        BadgeType.FAST,
        BadgeType.DIVERSE,
        BadgeType.CHALLENGE,
        BadgeType.CHALLENGE_OF_WEEK,
      ]),
    );
    expect(badges).not.toContain(BadgeType.ALMOST);
  });

  it('awards ALMOST only when the challenge is not completed', () => {
    const badges = evaluateBadges({
      consecutiveWeeks: 1,
      avgAnswerTimeSec: 10,
      categoriesAnswered: [],
      weeklyChallengesCompleted: 0,
      currentChallengeCompleted: false,
      currentChallengeRatio: 0.7,
    });
    expect(badges).toEqual([BadgeType.ALMOST]);
  });
});

describe('nickname', () => {
  it('validates length and characters', () => {
    expect(validateNickname('ab').valid).toBe(false);
    expect(validateNickname('a'.repeat(21)).valid).toBe(false);
    expect(validateNickname('hello world').valid).toBe(false);
    expect(validateNickname('cool_user_99').valid).toBe(true);
  });

  it('limits changes to once per 30 days', () => {
    const now = new Date('2026-06-11T00:00:00Z');
    expect(canChangeNickname(null, now)).toBe(true);
    expect(canChangeNickname(new Date('2026-06-01T00:00:00Z'), now)).toBe(false);
    expect(canChangeNickname(new Date('2026-05-01T00:00:00Z'), now)).toBe(true);
  });

  it('falls back to User #ID when no nickname is set', () => {
    expect(displayName({ nickname: null, id: 42 })).toBe('User #42');
    expect(displayName({ nickname: 'star', id: 42 })).toBe('star');
  });
});
