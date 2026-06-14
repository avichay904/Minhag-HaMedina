import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  filterServableQuestions,
  QuestionType,
  type RespondentContext,
  type ServableQuestion,
  type Targeting,
} from '@mhm/shared';
import type { ChoiceOptionDto, QuestionDto, AdminQuestionDto } from '@mhm/contracts';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { IQuestionService } from '../../common/facades';

import type { CreateQuestionDto } from './dto/question.dto';

@Injectable()
export class QuestionService implements IQuestionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the set of questions a respondent may still see:
   *  - active questions for the survey
   *  - excluding already-answered/skipped ids
   *  - filtered by targeting via @mhm/shared pure function
   */
  async getServableQuestions(args: {
    surveyId: string;
    ctx: RespondentContext;
    answeredQuestionIds: string[];
  }): Promise<QuestionDto[]> {
    const { surveyId, ctx, answeredQuestionIds } = args;

    const rows = await this.prisma.question.findMany({
      where: { surveyId, active: true },
    });

    const servableList: ServableQuestion[] = rows.map((q) => ({
      id: q.id,
      type: q.type as QuestionType,
      category: q.category,
      active: true,
      targeting: (q.targeting ?? {}) as Targeting,
      // ageInCycles is left undefined — cycle expiry is handled externally
      // by deactivating questions; expiresAfterCycles is also not used here
    }));

    const survivors = filterServableQuestions(servableList, { answeredQuestionIds, ctx });
    const survivorIds = new Set(survivors.map((s) => s.id));

    return rows
      .filter((r) => survivorIds.has(r.id))
      .map((q) => this.toDto(q));
  }

  /** Count of active (non-deactivated) questions for a survey. */
  async countActiveQuestions(surveyId: string): Promise<number> {
    return this.prisma.question.count({ where: { surveyId, active: true } });
  }

  /**
   * Create a question (Admin only — guard applied at controller level).
   *
   * Beyond the Zod contract validations (bilingual text, scale bounds presence,
   * options >= 2 for SINGLE_CHOICE) we enforce two additional business rules:
   *  - SCALE: scaleMin must be strictly less than scaleMax.
   *  - SINGLE_CHOICE: option keys must be unique within the set.
   */
  async createQuestion(dto: CreateQuestionDto): Promise<QuestionDto> {
    // Additional validation: SCALE range direction
    if (dto.type === QuestionType.SCALE) {
      if (dto.scaleMin != null && dto.scaleMax != null && dto.scaleMin >= dto.scaleMax) {
        throw new BadRequestException('scaleMin must be less than scaleMax');
      }
    }

    // Additional validation: SINGLE_CHOICE option key uniqueness
    if (dto.type === QuestionType.SINGLE_CHOICE && dto.options != null) {
      const keys = dto.options.map((o) => o.key);
      const uniqueKeys = new Set(keys);
      if (uniqueKeys.size !== keys.length) {
        throw new BadRequestException('option keys must be unique');
      }
    }

    // A question created mid-survey must start its expiry clock at the CURRENT
    // cycle, not cycle 1 — otherwise `expiresAfterCycles` would expire it
    // prematurely (e.g. created in cycle 3 with expiresAfterCycles=2 would have
    // expired at cycle 3 instead of cycle 5).
    const cycleAgg = await this.prisma.surveyCycle.aggregate({
      where: { surveyId: dto.surveyId },
      _max: { sequence: true },
    });
    const startCycleSequence = cycleAgg._max.sequence ?? 1;

    const created = await this.prisma.question.create({
      data: {
        surveyId: dto.surveyId,
        category: dto.category,
        textHe: dto.textHe,
        textEn: dto.textEn,
        type: dto.type,
        scaleMin: dto.scaleMin ?? null,
        scaleMax: dto.scaleMax ?? null,
        options: dto.options != null ? dto.options : Prisma.JsonNull,
        imageUrl: dto.imageUrl ?? null,
        expiresAfterCycles: dto.expiresAfterCycles ?? null,
        targeting: dto.targeting ?? {},
        startCycleSequence,
        active: true,
      },
    });

    return this.toDto(created);
  }

  /**
   * Admin: list all questions (all fields), optionally filtered by surveyId.
   */
  async listAllQuestions(surveyId?: string): Promise<AdminQuestionDto[]> {
    const rows = await this.prisma.question.findMany({
      where: surveyId ? { surveyId } : undefined,
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((q) => this.toAdminDto(q));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private toDto(q: {
    id: string;
    surveyId: string;
    category: string;
    type: string;
    textHe: string;
    textEn: string;
    scaleMin: number | null;
    scaleMax: number | null;
    options: unknown;
    imageUrl: string | null;
  }): QuestionDto {
    return {
      id: q.id,
      surveyId: q.surveyId,
      category: q.category as QuestionDto['category'],
      type: q.type as QuestionDto['type'],
      textHe: q.textHe,
      textEn: q.textEn,
      scaleMin: q.scaleMin,
      scaleMax: q.scaleMax,
      options: q.options as ChoiceOptionDto[] | null,
      imageUrl: q.imageUrl,
    };
  }

  private toAdminDto(q: {
    id: string;
    surveyId: string;
    category: string;
    type: string;
    textHe: string;
    textEn: string;
    scaleMin: number | null;
    scaleMax: number | null;
    options: unknown;
    imageUrl: string | null;
    targeting: unknown;
    active: boolean;
    expiresAfterCycles: number | null;
    startCycleSequence: number;
    createdAt: Date;
  }): AdminQuestionDto {
    return {
      id: q.id,
      surveyId: q.surveyId,
      category: q.category as AdminQuestionDto['category'],
      type: q.type as AdminQuestionDto['type'],
      textHe: q.textHe,
      textEn: q.textEn,
      scaleMin: q.scaleMin,
      scaleMax: q.scaleMax,
      options: q.options as ChoiceOptionDto[] | null,
      imageUrl: q.imageUrl,
      targeting: (q.targeting ?? null) as AdminQuestionDto['targeting'],
      active: q.active,
      expiresAfterCycles: q.expiresAfterCycles,
      startCycleSequence: q.startCycleSequence,
      createdAt: q.createdAt.toISOString(),
    };
  }
}
