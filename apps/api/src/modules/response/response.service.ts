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
  ): Promise<SubmitResponseResponse> {
    const question = await this.loadActiveQuestion(dto.questionId);

    const cycleInfo = await this.cycle.getActiveCycle(question.surveyId);
    const cycleId = cycleInfo?.id ?? '';

    const fraud = await this.antifraud.assess({
      respondentId: principal.respondentId,
      answerTimeMs: dto.answerTimeMs,
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

    const gamResult = await this.gamification.onResponseRecorded({
      respondentId: principal.respondentId ?? '',
      questionId: dto.questionId,
      category: question.category,
      questionType: question.type as QuestionType,
      cycleId,
      skipped: false,
      seen: true,
      answerTimeMs: dto.answerTimeMs,
    });

    return {
      accepted: true,
      pointsEarned: gamResult.pointsEarned,
      newBadges: gamResult.newBadges,
      challengeProgress: gamResult.challengeProgress,
    };
  }

  // ---------------------------------------------------------------------------
  // POST /responses/skip
  // ---------------------------------------------------------------------------

  async skip(
    dto: SkipDto,
    principal: Principal,
  ): Promise<SubmitResponseResponse> {
    const question = await this.loadActiveQuestion(dto.questionId);

    const cycleInfo = await this.cycle.getActiveCycle(question.surveyId);
    const cycleId = cycleInfo?.id ?? '';

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
          flagged: false,
          flagReason: null,
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
