import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ExternalSource } from '@prisma/client';
import {
  aggregateResult,
  AuthProvider,
  CycleState,
  QuestionType,
  resolveTrustScore,
  type ResponseLike,
  type ResultsScope,
} from '@mhm/shared';
import type { SurveyResults } from '@mhm/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { JwtPayload } from '../../common/types/jwt-payload';
import type { ExternalRegisterRequestDto } from './dto/external.dto';
import type { ExternalRespondentUpdateDto } from './dto/external.dto';

/** States that are publicly visible — results only flow out for these. */
const VISIBLE_STATES = new Set<CycleState>([CycleState.APPROVED, CycleState.PUBLISHED]);

@Injectable()
export class ExternalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // ------------------------------------------------------------------ register

  async registerRespondent(
    source: ExternalSource,
    dto: ExternalRegisterRequestDto,
  ): Promise<{ respondentId: string; token: string }> {
    if (!source.canRegisterUsers) {
      throw new ForbiddenException('This source is not permitted to register users');
    }

    const authProvider = AuthProvider.EXTERNAL_AUTHORIZED;
    const trustScore = resolveTrustScore({
      authProvider,
      source: {
        trustScoreMin: source.trustScoreMin,
        trustScoreMax: source.trustScoreMax,
      },
    });

    const respondent = await this.prisma.respondent.create({
      data: {
        authProvider,
        sourceId: source.id,
        externalId: dto.externalId ?? null,
        trustScore,
        preferredLanguage: dto.preferredLanguage ?? 'HE',
        age: dto.demographics?.age ?? null,
        gender: dto.demographics?.gender ?? null,
        region: dto.demographics?.region ?? null,
      },
    });

    const payload: JwtPayload = {
      sub: respondent.id,
      type: 'respondent',
      authProvider,
      trustScore,
      sourceId: source.id,
    };
    const token = this.jwt.sign(payload);

    return { respondentId: respondent.id, token };
  }

  // -------------------------------------------------------- update respondent

  async updateRespondent(
    source: ExternalSource,
    respondentId: string,
    dto: ExternalRespondentUpdateDto,
  ): Promise<void> {
    const respondent = await this.prisma.respondent.findUnique({
      where: { id: respondentId },
    });

    if (!respondent) {
      throw new NotFoundException('Respondent not found');
    }

    if (respondent.sourceId !== source.id) {
      throw new ForbiddenException('This respondent does not belong to your source');
    }

    await this.prisma.respondent.update({
      where: { id: respondentId },
      data: {
        externalId: dto.externalId !== undefined ? dto.externalId : respondent.externalId,
        preferredLanguage: dto.preferredLanguage ?? respondent.preferredLanguage,
        age: dto.demographics?.age !== undefined ? dto.demographics.age : respondent.age,
        gender: dto.demographics?.gender !== undefined ? dto.demographics.gender : respondent.gender,
        region: dto.demographics?.region !== undefined ? dto.demographics.region : respondent.region,
      },
    });
  }

  // --------------------------------------------------------------- results

  async getResults(source: ExternalSource): Promise<SurveyResults[]> {
    if (!source.canReadResults) {
      throw new ForbiddenException('This source is not permitted to read results');
    }

    const resultsScope = (source.resultsScope as ResultsScope | null) ?? {
      ownRespondentsOnly: true,
      categories: [],
    };

    // Fetch all APPROVED/PUBLISHED cycles with their survey and questions.
    const cycles = await this.prisma.surveyCycle.findMany({
      where: {
        state: { in: [CycleState.APPROVED, CycleState.PUBLISHED] },
      },
      include: {
        survey: {
          include: {
            questions: {
              where: { active: true },
            },
          },
        },
      },
    });

    // Gather the respondent IDs belonging to this source (needed for scoping).
    const ownRespondentIds = await this.getOwnRespondentIds(source.id);
    const ownIdSet = new Set(ownRespondentIds);

    const results: SurveyResults[] = [];

    for (const cycle of cycles) {
      const survey = cycle.survey;
      if (!VISIBLE_STATES.has(cycle.state as CycleState)) continue;

      // Apply category filter — empty means all.
      const allowedCategories = resultsScope.categories;
      const questions = survey.questions.filter(
        (q) => allowedCategories.length === 0 || allowedCategories.includes(q.category as any),
      );

      if (questions.length === 0) continue;

      // Fetch responses for these questions, scoped to source's respondents.
      const questionIds = questions.map((q) => q.id);

      // Scope to the source's own respondents ONLY when results_scope says so;
      // a source with ownRespondentsOnly=false is permitted cross-respondent results.
      const responses = await this.prisma.response.findMany({
        where: {
          questionId: { in: questionIds },
          ...(resultsScope.ownRespondentsOnly ? { respondentId: { in: ownRespondentIds } } : {}),
        },
      });

      // Group responses by questionId.
      const responsesByQuestion = new Map<string, typeof responses>();
      for (const r of responses) {
        if (resultsScope.ownRespondentsOnly && r.respondentId && !ownIdSet.has(r.respondentId)) {
          continue;
        }
        const arr = responsesByQuestion.get(r.questionId) ?? [];
        arr.push(r);
        responsesByQuestion.set(r.questionId, arr);
      }

      // Compute distinct respondent count for this cycle+source.
      const respondentIdsInCycle = new Set(
        responses.map((r) => r.respondentId).filter(Boolean) as string[],
      );
      const totalRespondents = respondentIdsInCycle.size;

      const questionSummaries = questions.map((q) => {
        const qResponses = responsesByQuestion.get(q.id) ?? [];
        const responseLikes: ResponseLike[] = qResponses.map((r) => ({
          answerValue: r.answerValue ?? undefined,
          skipped: r.skipped,
          trustScore: r.trustScoreAtSubmission,
          rawCounted: r.rawCounted,
        }));

        const summary = aggregateResult(responseLikes, {
          questionType: q.type as QuestionType,
          displayMode: cycle.displayMode,
        });

        return {
          questionId: q.id,
          textHe: q.textHe,
          textEn: q.textEn,
          ...summary,
          skipRate:
            summary.totalResponses + summary.skippedCount > 0
              ? summary.skippedCount / (summary.totalResponses + summary.skippedCount)
              : 0,
        };
      });

      results.push({
        surveyId: survey.id,
        cycleId: cycle.id,
        state: cycle.state as CycleState,
        displayMode: cycle.displayMode,
        totalRespondents,
        questions: questionSummaries,
      });
    }

    return results;
  }

  // ----------------------------------------------------------------- helpers

  private async getOwnRespondentIds(sourceId: string): Promise<string[]> {
    const respondents = await this.prisma.respondent.findMany({
      where: { sourceId },
      select: { id: true },
    });
    return respondents.map((r) => r.id);
  }
}
