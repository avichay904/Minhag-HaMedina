import { Injectable } from '@nestjs/common';
import { rankForStats } from '@mhm/shared';
import type { BadgeStats, Category } from '@mhm/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  IGamificationService,
  ResponseGamificationInput,
  ResponseGamificationResult,
  ProfileGamification,
} from '../../common/facades';

import { RankService } from './rank.service';
import { BadgeService } from './badge.service';
import { ChallengeService } from './challenge.service';

@Injectable()
export class GamificationService implements IGamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankService: RankService,
    private readonly badgeService: BadgeService,
    private readonly challengeService: ChallengeService,
  ) {}

  // ---------------------------------------------------------------------------
  // onResponseRecorded
  // ---------------------------------------------------------------------------

  async onResponseRecorded(input: ResponseGamificationInput): Promise<ResponseGamificationResult> {
    // 1. Increment answeredCount and award base point when not skipped.
    let respondent = await this.prisma.respondent.findUniqueOrThrow({
      where: { id: input.respondentId },
    });

    let basePoints = 0;
    if (!input.skipped) {
      respondent = await this.prisma.respondent.update({
        where: { id: input.respondentId },
        data: {
          answeredCount: { increment: 1 },
          points: { increment: 1 },
        },
      });
      basePoints = 1;
    }

    // 2. Update challenge progress.
    const progressResult = await this.challengeService.updateProgress({
      respondentId: input.respondentId,
      cycleId: input.cycleId,
      skipped: input.skipped,
      seen: input.seen,
      respondentAnsweredCount: respondent.answeredCount,
      respondentTrustScore: respondent.trustScore,
    });

    // 3. Apply challenge reward (bonus points).
    let bonusPoints = 0;
    let currentChallengeCompleted = false;
    let currentChallengeRatio = 0;

    if (progressResult) {
      bonusPoints = progressResult.reward.bonusPoints;
      currentChallengeCompleted = progressResult.completed;
      currentChallengeRatio =
        progressResult.target > 0
          ? progressResult.countAnswered / progressResult.target
          : 0;

      if (bonusPoints > 0) {
        await this.prisma.respondent.update({
          where: { id: input.respondentId },
          data: { points: { increment: bonusPoints } },
        });
      }
    }

    // 4. Build badge stats and award new badges.
    const [weeklyChallengesCompleted, consecutiveWeeks, avgAnswerTimeSec, categoriesAnswered] =
      await Promise.all([
        this.challengeService.countCompletedChallenges(input.respondentId),
        this.challengeService.countDistinctCyclesParticipated(input.respondentId),
        this.computeAvgAnswerTimeSec(input.respondentId),
        this.computeCategoriesAnswered(input.respondentId),
      ]);

    const stats: BadgeStats = {
      consecutiveWeeks,
      avgAnswerTimeSec,
      categoriesAnswered,
      weeklyChallengesCompleted,
      currentChallengeCompleted,
      currentChallengeRatio,
    };

    const newBadges = await this.badgeService.awardNewBadges(input.respondentId, stats);

    return {
      pointsEarned: basePoints + bonusPoints,
      newBadges,
      challengeProgress: progressResult
        ? {
            target: progressResult.target,
            countAnswered: progressResult.countAnswered,
            countSeen: progressResult.countSeen,
            completed: progressResult.completed,
          }
        : null,
    };
  }

  // ---------------------------------------------------------------------------
  // generateChallengeForCycle
  // ---------------------------------------------------------------------------

  async generateChallengeForCycle(cycleId: string): Promise<void> {
    await this.challengeService.generateChallengeForCycle(cycleId);
  }

  // ---------------------------------------------------------------------------
  // getProfileGamification
  // ---------------------------------------------------------------------------

  async getProfileGamification(respondentId: string): Promise<ProfileGamification> {
    const respondent = await this.prisma.respondent.findUniqueOrThrow({
      where: { id: respondentId },
    });

    const rank = this.rankService.forStats(respondent.answeredCount, respondent.trustScore);
    const rankProgressData = this.rankService.progress(
      respondent.answeredCount,
      respondent.trustScore,
    );
    const badges = await this.badgeService.getBadgeTypes(respondentId);

    return {
      rank,
      badges,
      points: respondent.points,
      surveysCompleted: respondent.answeredCount,
      rankProgress: rankProgressData,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async computeAvgAnswerTimeSec(respondentId: string): Promise<number | null> {
    const rows = await this.prisma.response.findMany({
      where: { respondentId, answerTimeMs: { not: null } },
      select: { answerTimeMs: true },
    });
    if (rows.length === 0) return null;
    const sum = rows.reduce((acc, r) => acc + (r.answerTimeMs ?? 0), 0);
    return sum / rows.length / 1000;
  }

  private async computeCategoriesAnswered(respondentId: string): Promise<Category[]> {
    const rows = await this.prisma.response.findMany({
      where: { respondentId, skipped: false },
      select: { question: { select: { category: true } } },
    });
    const unique = new Set(rows.map((r) => r.question.category as Category));
    return [...unique];
  }
}
