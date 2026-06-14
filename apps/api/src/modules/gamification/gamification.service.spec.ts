import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadgeType, Category, Rank } from '@mhm/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

import { RankService } from './rank.service';
import { BadgeService } from './badge.service';
import { ChallengeService } from './challenge.service';
import { GamificationService } from './gamification.service';
import type { ResponseGamificationInput } from '../../common/facades';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_RESPONDENT = {
  id: 'resp-1',
  answeredCount: 5,
  trustScore: 0.8,
  points: 10,
  nickname: null,
  nicknameChangedAt: null,
  showInLeaderboard: false,
  preferredLanguage: 'HE',
  preferredCategories: [],
  age: null,
  gender: null,
  region: null,
  authProvider: 'GOOGLE',
  externalId: null,
  sourceId: null,
  fingerprintHash: null,
  email: null,
  notificationToken: null,
  flagged: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const FAKE_INPUT: ResponseGamificationInput = {
  respondentId: 'resp-1',
  questionId: 'q-1',
  category: Category.GENERAL,
  questionType: 'YES_NO',
  cycleId: 'cycle-1',
  skipped: false,
  seen: true,
  answerTimeMs: 3000,
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    respondent: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ ...BASE_RESPONDENT }),
      update: vi.fn().mockResolvedValue({ ...BASE_RESPONDENT, answeredCount: 6, points: 11 }),
    },
    response: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

function buildRankServiceMock() {
  return {
    forStats: vi.fn().mockReturnValue(Rank.BEGINNER),
    progress: vi.fn().mockReturnValue({
      current: Rank.BEGINNER,
      next: Rank.CONTRIBUTOR,
      surveysToNext: 10,
      trustBlockedNext: false,
    }),
  };
}

function buildBadgeServiceMock() {
  return {
    awardNewBadges: vi.fn().mockResolvedValue([]),
    getBadgeTypes: vi.fn().mockResolvedValue([BadgeType.STREAK]),
  };
}

function buildChallengeServiceMock() {
  return {
    generateChallengeForCycle: vi.fn().mockResolvedValue(undefined),
    updateProgress: vi.fn().mockResolvedValue({
      target: 5,
      countAnswered: 3,
      countSeen: 4,
      completed: false,
      reward: { badge: null, bonusPoints: 0 },
    }),
    countCompletedChallenges: vi.fn().mockResolvedValue(2),
    countDistinctCyclesParticipated: vi.fn().mockResolvedValue(4),
  };
}

async function buildModule(overrides: {
  prisma?: ReturnType<typeof buildPrismaMock>;
  rank?: ReturnType<typeof buildRankServiceMock>;
  badge?: ReturnType<typeof buildBadgeServiceMock>;
  challenge?: ReturnType<typeof buildChallengeServiceMock>;
} = {}): Promise<{
  service: GamificationService;
  prisma: ReturnType<typeof buildPrismaMock>;
  rank: ReturnType<typeof buildRankServiceMock>;
  badge: ReturnType<typeof buildBadgeServiceMock>;
  challenge: ReturnType<typeof buildChallengeServiceMock>;
}> {
  const prisma = overrides.prisma ?? buildPrismaMock();
  const rank = overrides.rank ?? buildRankServiceMock();
  const badge = overrides.badge ?? buildBadgeServiceMock();
  const challenge = overrides.challenge ?? buildChallengeServiceMock();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      GamificationService,
      { provide: PrismaService, useValue: prisma },
      { provide: RankService, useValue: rank },
      { provide: BadgeService, useValue: badge },
      { provide: ChallengeService, useValue: challenge },
    ],
  }).compile();

  return {
    service: module.get(GamificationService),
    prisma,
    rank,
    badge,
    challenge,
  };
}

// ---------------------------------------------------------------------------
// onResponseRecorded
// ---------------------------------------------------------------------------

describe('GamificationService.onResponseRecorded', () => {
  it('increments answeredCount and awards 1 base point when not skipped', async () => {
    const { service, prisma } = await buildModule();

    const result = await service.onResponseRecorded(FAKE_INPUT);

    expect(prisma.respondent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          answeredCount: { increment: 1 },
          points: { increment: 1 },
        }),
      }),
    );
    expect(result.pointsEarned).toBeGreaterThanOrEqual(1);
  });

  it('does NOT increment answeredCount when skipped', async () => {
    const { service, prisma } = await buildModule();

    await service.onResponseRecorded({ ...FAKE_INPUT, skipped: true });

    // update should NOT have been called for answeredCount increment
    const updateCalls = prisma.respondent.update.mock.calls;
    const answeredCountIncrementCall = updateCalls.find(
      (call) => call[0]?.data?.answeredCount?.increment === 1,
    );
    expect(answeredCountIncrementCall).toBeUndefined();
  });

  it('adds bonus points when challenge reward has bonusPoints > 0', async () => {
    const challenge = buildChallengeServiceMock();
    challenge.updateProgress.mockResolvedValue({
      target: 5,
      countAnswered: 5,
      completed: true,
      countSeen: 5,
      reward: { badge: 'CHALLENGE_OF_WEEK', bonusPoints: 3 },
    });

    const prisma = buildPrismaMock();
    const { service } = await buildModule({ prisma, challenge });

    const result = await service.onResponseRecorded(FAKE_INPUT);

    // Should have called update for bonus points
    const bonusUpdateCall = prisma.respondent.update.mock.calls.find(
      (call) => call[0]?.data?.points?.increment === 3,
    );
    expect(bonusUpdateCall).toBeDefined();
    expect(result.pointsEarned).toBe(4); // 1 base + 3 bonus
  });

  it('returns null challengeProgress when no WeeklyChallenge exists for cycle', async () => {
    const challenge = buildChallengeServiceMock();
    challenge.updateProgress.mockResolvedValue(null);

    const { service } = await buildModule({ challenge });

    const result = await service.onResponseRecorded(FAKE_INPUT);

    expect(result.challengeProgress).toBeNull();
  });

  it('returns the challenge progress view when progress exists', async () => {
    const { service } = await buildModule();

    const result = await service.onResponseRecorded(FAKE_INPUT);

    expect(result.challengeProgress).toEqual({
      target: 5,
      countAnswered: 3,
      countSeen: 4,
      completed: false,
    });
  });

  it('calls badgeService.awardNewBadges and includes new badges in result', async () => {
    const badge = buildBadgeServiceMock();
    badge.awardNewBadges.mockResolvedValue([BadgeType.FAST]);

    const { service } = await buildModule({ badge });

    const result = await service.onResponseRecorded(FAKE_INPUT);

    expect(badge.awardNewBadges).toHaveBeenCalledOnce();
    expect(result.newBadges).toContain(BadgeType.FAST);
  });

  it('passes correct BadgeStats (with currentChallengeCompleted=true) when challenge completed', async () => {
    const challenge = buildChallengeServiceMock();
    challenge.updateProgress.mockResolvedValue({
      target: 5,
      countAnswered: 5,
      completed: true,
      countSeen: 5,
      reward: { badge: 'CHALLENGE_OF_WEEK', bonusPoints: 3 },
    });
    challenge.countCompletedChallenges.mockResolvedValue(3);
    challenge.countDistinctCyclesParticipated.mockResolvedValue(5);

    const badge = buildBadgeServiceMock();
    const { service } = await buildModule({ challenge, badge });

    await service.onResponseRecorded(FAKE_INPUT);

    expect(badge.awardNewBadges).toHaveBeenCalledWith(
      'resp-1',
      expect.objectContaining({
        currentChallengeCompleted: true,
        weeklyChallengesCompleted: 3,
        consecutiveWeeks: 5,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// generateChallengeForCycle
// ---------------------------------------------------------------------------

describe('GamificationService.generateChallengeForCycle', () => {
  it('delegates to challengeService.generateChallengeForCycle', async () => {
    const { service, challenge } = await buildModule();

    await service.generateChallengeForCycle('cycle-42');

    expect(challenge.generateChallengeForCycle).toHaveBeenCalledWith('cycle-42');
  });
});

// ---------------------------------------------------------------------------
// getProfileGamification
// ---------------------------------------------------------------------------

describe('GamificationService.getProfileGamification', () => {
  it('returns correct ProfileGamification shape', async () => {
    const { service } = await buildModule();

    const profile = await service.getProfileGamification('resp-1');

    expect(profile).toMatchObject({
      rank: Rank.BEGINNER,
      badges: [BadgeType.STREAK],
      points: BASE_RESPONDENT.points,
      surveysCompleted: BASE_RESPONDENT.answeredCount,
    });
    expect(profile.rankProgress).toBeDefined();
  });

  it('calls rankService.forStats with respondent answeredCount and trustScore', async () => {
    const { service, rank } = await buildModule();

    await service.getProfileGamification('resp-1');

    expect(rank.forStats).toHaveBeenCalledWith(
      BASE_RESPONDENT.answeredCount,
      BASE_RESPONDENT.trustScore,
    );
  });

  it('calls badgeService.getBadgeTypes with respondentId', async () => {
    const { service, badge } = await buildModule();

    await service.getProfileGamification('resp-1');

    expect(badge.getBadgeTypes).toHaveBeenCalledWith('resp-1');
  });
});

// ---------------------------------------------------------------------------
// RankService — pure wiring tests
// ---------------------------------------------------------------------------

describe('RankService', () => {
  let rankService: RankService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RankService],
    }).compile();
    rankService = module.get(RankService);
  });

  it('returns GUEST for a new respondent (0 surveys, any trust)', () => {
    expect(rankService.forStats(0, 0.4)).toBe(Rank.GUEST);
  });

  it('returns BEGINNER after meeting threshold', () => {
    // BEGINNER threshold: minSurveys=3, minTrust=0.4 per RANK_THRESHOLDS
    expect(rankService.forStats(3, 0.6)).toBe(Rank.BEGINNER);
  });

  it('progress returns a RankProgress object', () => {
    const progress = rankService.progress(0, 0.4);
    expect(progress).toHaveProperty('current');
    expect(progress).toHaveProperty('next');
    expect(progress).toHaveProperty('surveysToNext');
    expect(progress).toHaveProperty('trustBlockedNext');
  });
});
