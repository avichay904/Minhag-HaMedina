import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { QuestionType } from '@mhm/shared';
import type { Principal } from '@mhm/shared';
import type { SubmitResponseResponse, AnsweredResponse } from '@mhm/contracts';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ANTIFRAUD_SERVICE,
  CYCLE_SERVICE,
  GAMIFICATION_SERVICE,
  type IAntifraudService,
  type ICycleService,
  type IGamificationService,
} from '../../common/facades';

import type { SubmitResponseDto } from './dto/response.dto';
import type { SkipDto } from './dto/response.dto';

/** Prisma unique-constraint violation error code. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/**
 * Normalises an incoming answerValue to the canonical string form required by
 * the Response model:
 *   - yes_no     → '1' (truthy string) or '0'
 *   - scale      → the number as a string
 *   - single_choice → the chosen option key (already a string)
 */
function normaliseAnswerValue(
  raw: string | number,
  questionType: QuestionType,
): string {
  if (questionType === QuestionType.YES_NO) {
    // Accept boolean-like strings ('true','false','yes','no') and numbers.
    const asString = String(raw).toLowerCase();
    if (asString === 'true' || asString === 'yes' || asString === '1') return '1';
    return '0';
  }

  if (questionType === QuestionType.SCALE) {
    return String(Number(raw));
  }

  // SINGLE_CHOICE / TEXT_IMAGE — pass through as string.
  return String(raw);
}

@Injectable()
export class ResponseService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GAMIFICATION_SERVICE)
    private readonly gamification: IGamificationService,
    @Inject(CYCLE_SERVICE)
    private readonly cycle: ICycleService,
    @Inject(ANTIFRAUD_SERVICE)
    private readonly antifraud: IAntifraudService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /responses
  // ---------------------------------------------------------------------------

  async submit(
    dto: SubmitResponseDto,
    principal: Principal,
    ip?: string,
  ): Promise<SubmitResponseResponse> {
    const question = await this.loadActiveQuestion(dto.questionId);

    const cycleInfo = await this.cycle.getActiveCycle(question.surveyId);
    const cycleId = cycleInfo?.id ?? '';

    const fraud = await this.antifraud.assess({
      respondentId: principal.respondentId,
      answerTimeMs: dto.answerTimeMs,
      ip,
    });

    const answerValue = normaliseAnswerValue(dto.answerValue, question.type as QuestionType);

    try {
      await this.prisma.response.create({
        data: {
          questionId: dto.questionId,
          respondentId: principal.respondentId ?? null,
          answerValue,
          skipped: false,
          seen: true,
          trustScoreAtSubmission: principal.trustScore,
          source: principal.xSource,
          rawCounted: !fraud.flagged,
          flagged: fraud.flagged,
          flagReason: fraud.reason ?? null,
          answerTimeMs: dto.answerTimeMs ?? null,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === PRISMA_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Question already answered');
      }
      throw err;
    }

    const [gamResult, percentileToday] = await Promise.all([
      this.gamification.onResponseRecorded({
        respondentId: principal.respondentId ?? '',
        questionId: dto.questionId,
        category: question.category,
        questionType: question.type as QuestionType,
        cycleId,
        skipped: false,
        seen: true,
        answerTimeMs: dto.answerTimeMs,
      }),
      principal.respondentId
        ? this.computePercentileToday(principal.respondentId)
        : Promise.resolve(null),
    ]);

    return {
      accepted: true,
      pointsEarned: gamResult.pointsEarned,
      newBadges: gamResult.newBadges,
      challengeProgress: gamResult.challengeProgress,
      percentileToday,
    };
  }

  // ---------------------------------------------------------------------------
  // POST /responses/skip
  // ---------------------------------------------------------------------------

  async skip(
    dto: SkipDto,
    principal: Principal,
    ip?: string,
  ): Promise<SubmitResponseResponse> {
    const question = await this.loadActiveQuestion(dto.questionId);

    const cycleInfo = await this.cycle.getActiveCycle(question.surveyId);
    const cycleId = cycleInfo?.id ?? '';

    // Assess IP velocity for skips as well (no answerTimeMs for skips).
    const skipFraud = await this.antifraud.assess({
      respondentId: principal.respondentId,
      ip,
    });

    // Scale skips do NOT count as "seen" for the weekly challenge.
    const seen = question.type !== QuestionType.SCALE;

    try {
      await this.prisma.response.create({
        data: {
          questionId: dto.questionId,
          respondentId: principal.respondentId ?? null,
          answerValue: null,
          skipped: true,
          seen,
          trustScoreAtSubmission: principal.trustScore,
          source: principal.xSource,
          rawCounted: false,
          flagged: skipFraud.flagged,
          flagReason: skipFraud.reason ?? null,
          answerTimeMs: null,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === PRISMA_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Question already answered');
      }
      throw err;
    }

    const gamResult = await this.gamification.onResponseRecorded({
      respondentId: principal.respondentId ?? '',
      questionId: dto.questionId,
      category: question.category,
      questionType: question.type as QuestionType,
      cycleId,
      skipped: true,
      seen,
    });

    return {
      accepted: true,
      pointsEarned: gamResult.pointsEarned,
      newBadges: gamResult.newBadges,
      challengeProgress: gamResult.challengeProgress,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /respondent/answered
  // ---------------------------------------------------------------------------

  async getAnswered(respondentId: string): Promise<AnsweredResponse> {
    const rows = await this.prisma.response.findMany({
      where: { respondentId },
      select: {
        questionId: true,
        skipped: true,
        answeredAt: true,
      },
      orderBy: { answeredAt: 'desc' },
    });

    return rows.map((r) => ({
      questionId: r.questionId,
      skipped: r.skipped,
      answeredAt: r.answeredAt.toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute the top-N percentile for the given respondent based on how many
   * non-skipped responses they gave today vs all respondents who answered today.
   *
   * Returns a value 0–100 where lower = better (e.g. 5 means top 5%).
   * Returns null if it cannot be computed.
   */
  private async computePercentileToday(respondentId: string): Promise<number | null> {
    const todayMidnightUtc = new Date();
    todayMidnightUtc.setUTCHours(0, 0, 0, 0);

    // 1. Count how many answers this respondent gave today.
    const myCount = await this.prisma.response.count({
      where: {
        respondentId,
        skipped: false,
        answeredAt: { gte: todayMidnightUtc },
      },
    });

    if (myCount === 0) return null;

    // 2. Count distinct respondents who gave strictly fewer answers today than myCount.
    //    We use groupBy respondentId and filter for counts < myCount.
    const lessActive = await this.prisma.response.groupBy({
      by: ['respondentId'],
      where: {
        skipped: false,
        answeredAt: { gte: todayMidnightUtc },
        respondentId: { not: null },
      },
      having: {
        respondentId: { _count: { lt: myCount } },
      },
      _count: { respondentId: true },
    });

    const totalRespondents = await this.prisma.response.findMany({
      where: {
        skipped: false,
        answeredAt: { gte: todayMidnightUtc },
        respondentId: { not: null },
      },
      select: { respondentId: true },
      distinct: ['respondentId'],
    });

    const total = totalRespondents.length;
    if (total <= 1) return 1; // only this respondent, top 1%

    // percentileToday = fraction of respondents this one outperforms (top-N%)
    const countBelow = lessActive.length;
    const percentile = Math.ceil(((total - countBelow) / total) * 100);
    return Math.max(1, Math.min(100, percentile));
  }

  private async loadActiveQuestion(questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    if (!question.active) {
      throw new NotFoundException('Question is not active');
    }

    return question;
  }
}
