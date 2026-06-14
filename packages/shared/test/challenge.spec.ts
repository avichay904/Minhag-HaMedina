import { describe, expect, it } from 'vitest';
import { Rank, challengeReward, computeChallengeTarget, rankStepsAboveBeginner } from '../src/index.js';

describe('rankStepsAboveBeginner', () => {
  it('is 0 at or below Beginner, increasing above', () => {
    expect(rankStepsAboveBeginner(Rank.GUEST)).toBe(0);
    expect(rankStepsAboveBeginner(Rank.BEGINNER)).toBe(0);
    expect(rankStepsAboveBeginner(Rank.CONTRIBUTOR)).toBe(1);
    expect(rankStepsAboveBeginner(Rank.VETERAN)).toBe(2);
    expect(rankStepsAboveBeginner(Rank.AMBASSADOR)).toBe(3);
  });
});

describe('computeChallengeTarget', () => {
  it('returns 0 when there are no active questions', () => {
    expect(computeChallengeTarget({ activeQuestionCount: 0, avgPerWeek: 10, rank: Rank.AMBASSADOR })).toBe(0);
  });

  it('respects the 80% ceiling', () => {
    // N=10 → ceiling = floor(8) = 8. base = min(10, max(3, round(10*1.1)=11)) = 10. Beginner mult=1 → 10, capped to 8.
    expect(computeChallengeTarget({ activeQuestionCount: 10, avgPerWeek: 10, rank: Rank.BEGINNER })).toBe(8);
  });

  it('applies the +10%/rank difficulty bonus but never exceeds the ceiling or N', () => {
    // N=20, avg=5 → base = min(20, max(3, round(5.5)=6)) = 6. ceiling = floor(16)=16.
    // Ambassador: mult = 1 + 0.1*3 = 1.3 → round(6*1.3)=round(7.8)=8.
    expect(computeChallengeTarget({ activeQuestionCount: 20, avgPerWeek: 5, rank: Rank.AMBASSADOR })).toBe(8);
    // Beginner baseline for the same inputs is 6.
    expect(computeChallengeTarget({ activeQuestionCount: 20, avgPerWeek: 5, rank: Rank.BEGINNER })).toBe(6);
  });

  it('enforces the minimum base of 3 (subject to ceiling)', () => {
    // N=5, avg=0 → base = min(5, max(3, 0)) = 3. ceiling = floor(4)=4 → 3.
    expect(computeChallengeTarget({ activeQuestionCount: 5, avgPerWeek: 0, rank: Rank.BEGINNER })).toBe(3);
  });
});

describe('challengeReward', () => {
  it('rewards full completion with the badge + 3 points', () => {
    expect(challengeReward(8, 8)).toEqual({ badge: 'CHALLENGE_OF_WEEK', bonusPoints: 3 });
    expect(challengeReward(10, 8)).toEqual({ badge: 'CHALLENGE_OF_WEEK', bonusPoints: 3 });
  });
  it('rewards ≥70% with the "almost" badge + 1 point', () => {
    expect(challengeReward(7, 10)).toEqual({ badge: 'ALMOST', bonusPoints: 1 });
  });
  it('gives nothing below 70% and never penalises a miss', () => {
    expect(challengeReward(3, 10)).toEqual({ badge: null, bonusPoints: 0 });
    expect(challengeReward(0, 10)).toEqual({ badge: null, bonusPoints: 0 });
  });
});
