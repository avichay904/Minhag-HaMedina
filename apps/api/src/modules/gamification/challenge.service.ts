import { Injectable } from '@nestjs/common';
import { computeChallengeTarget, challengeReward, Rank, rankForStats } from '@mhm/shared';
import type { ChallengeReward } from '@mhm/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

/** Default community average when no historic data is available. */
const DEFAULT_AVG_PER_WEEK = 5;

@Injectable()
export class ChallengeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate (or update) the WeeklyChallenge record for a cycle.
   * targetCount is computed for a Rank.BEGINNER respondent so it acts as the
   * baseline; each respondent's personal target is computed at response-time.
   */
  async generateChallengeForCycle(cycleId: string): Promise<void> {
    const cycle = await this.prisma.surveyCycle.findUnique({
      where: { id: cycleId },
      select: { surveyId: true },
    });
    if (!cycle) return;

    const activeCount = await this.prisma.question.count({
      where: { surveyId: cycle.surveyId, active: true },
    });

    const avgPerWeek = DEFAULT_AVG_PER_WEEK;
    const targetCount = computeChallengeTarget({
      activeQuestionCount: activeCount,
      avgPerWeek,
      rank: Rank.BEGINNER,
    });

    await this.prisma.weeklyChallenge.upsert({
      where: { cycleId },
      create: { cycleId, targetCount, avgPerWeek },
      update: { targetCount, avgPerWeek },
    });
  }

  /**
   * Update or upsert ChallengeProgress for one response event.
   * Returns the progress state (including target and reward) or null when
   * no WeeklyChallenge exists for the cycle.
   */
  async updateProgress(args: {
    respondentId: string;
    cycleId: string;
    skipped: boolean;
    seen: boolean;
    respondentAnsweredCount: number;
    respondentTrustScore: number;
  }): Promise<{
    target: number;
    countAnswered: number;
    countSeen: number;
    completed: boolean;
    reward: ChallengeReward;
  } | null> {
    const challenge = await this.prisma.weeklyChallenge.findUnique({
      where: { cycleId: args.cycleId },
    });
    if (!challenge) return null;

    // Count active questions for the cycle's survey to derive the personal target.
    const cycleRecord = await this.prisma.surveyCycle.findUnique({
      where: { id: args.cycleId },
      select: { surveyId: true },
    });
    const activeCount = cycleRecord
      ? await this.prisma.question.count({
          where: { surveyId: cycleRecord.surveyId, active: true },
        })
      : 0;

    const rank = rankForStats({
      surveysCompleted: args.respondentAnsweredCount,
      trustScore: args.respondentTrustScore,
    });

    const avgPerWeek = challenge.avgPerWeek ?? DEFAULT_AVG_PER_WEEK;
    const target = computeChallengeTarget({
      activeQuestionCount: activeCount,
      avgPerWeek,
      rank,
    });

    // Upsert progress, incrementing counters atomically.
    const current = await this.prisma.challengeProgress.upsert({
      where: {
        challengeId_respondentId: {
          challengeId: challenge.id,
          respondentId: args.respondentId,
        },
      },
      create: {
        challengeId: challenge.id,
        respondentId: args.respondentId,
        countSeen: args.seen ? 1 : 0,
        countAnswered: args.skipped ? 0 : 1,
        completed: false,
      },
      update: {
        countSeen: { increment: args.seen ? 1 : 0 },
        countAnswered: { increment: args.skipped ? 0 : 1 },
      },
    });

    const completed = current.countAnswered >= target;
    const reward = challengeReward(current.countAnswered, target);

    if (completed && !current.completed) {
      await this.prisma.challengeProgress.update({
        where: { id: current.id },
        data: { completed: true },
      });
    }

    return {
      target,
      countAnswered: current.countAnswered,
      countSeen: current.countSeen,
      completed,
      reward,
    };
  }

  async countCompletedChallenges(respondentId: string): Promise<number> {
    return this.prisma.challengeProgress.count({
      where: { respondentId, completed: true },
    });
  }

  /**
   * Count distinct cycles in which the respondent participated.
   * Used as a heuristic for consecutiveWeeks in badge stats.
   */
  async countDistinctCyclesParticipated(respondentId: string): Promise<number> {
    const rows = await this.prisma.challengeProgress.findMany({
      where: { respondentId },
      select: {
        challenge: { select: { cycleId: true } },
      },
    });
    return new Set(rows.map((r) => r.challenge.cycleId)).size;
  }
}
