import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  aggregateResult,
  CycleState,
  DisplayMode,
  displayName,
  QuestionType,
  rankForStats,
  type ResponseLike,
} from '@mhm/shared';
import type { LeaderboardResponse, SurveyResults } from '@mhm/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Cycle states that are publicly visible. */
const PUBLIC_STATES = new Set<string>([CycleState.APPROVED, CycleState.PUBLISHED]);

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------- /results/:surveyId (admin)

  /**
   * Admin view: aggregates results in real time using DisplayMode.BOTH.
   * Uses the survey's latest cycle regardless of state.
   */
  async getAdminResults(surveyId: string): Promise<SurveyResults> {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException(`Survey ${surveyId} not found`);

    const cycle = await this.prisma.surveyCycle.findFirst({
      where: { surveyId },
      orderBy: { sequence: 'desc' },
    });
    if (!cycle) throw new NotFoundException(`No cycle found for survey ${surveyId}`);

    const questions = await this.prisma.question.findMany({
      where: { surveyId, active: true },
    });

    const questionIds = questions.map((q) => q.id);
    const responses = await this.prisma.response.findMany({
      where: { questionId: { in: questionIds } },
    });

    const responsesByQuestion = groupByQuestionId(responses);

    const totalRespondents = countDistinctRespondents(responses);

    const questionSummaries = questions.map((q) => {
      const qResponses = responsesByQuestion.get(q.id) ?? [];
      const responseLikes = toResponseLikes(qResponses);
      const summary = aggregateResult(responseLikes, {
        questionType: q.type as QuestionType,
        displayMode: DisplayMode.BOTH,
      });
      return {
        questionId: q.id,
        textHe: q.textHe,
        textEn: q.textEn,
        ...summary,
        skipRate: computeSkipRate(summary.totalResponses, summary.skippedCount),
      };
    });

    return {
      surveyId,
      cycleId: cycle.id,
      state: cycle.state as CycleState,
      displayMode: DisplayMode.BOTH,
      totalRespondents,
      questions: questionSummaries,
    };
  }

  // -------------------------------------------------- /results/:surveyId/public

  /**
   * Public view: only works when the latest cycle is APPROVED or PUBLISHED.
   * Respects the cycle's displayMode.
   */
  async getPublicResults(surveyId: string): Promise<SurveyResults> {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException(`Survey ${surveyId} not found`);

    const cycle = await this.prisma.surveyCycle.findFirst({
      where: { surveyId },
      orderBy: { sequence: 'desc' },
    });
    if (!cycle) throw new NotFoundException(`No cycle found for survey ${surveyId}`);

    if (!PUBLIC_STATES.has(cycle.state)) {
      throw new ForbiddenException('Results not yet published');
    }

    const questions = await this.prisma.question.findMany({
      where: { surveyId, active: true },
    });

    const questionIds = questions.map((q) => q.id);
    const responses = await this.prisma.response.findMany({
      where: { questionId: { in: questionIds } },
    });

    const responsesByQuestion = groupByQuestionId(responses);
    const totalRespondents = countDistinctRespondents(responses);
    const cycleDisplayMode = cycle.displayMode as DisplayMode;

    const questionSummaries = questions.map((q) => {
      const qResponses = responsesByQuestion.get(q.id) ?? [];
      const responseLikes = toResponseLikes(qResponses);
      const summary = aggregateResult(responseLikes, {
        questionType: q.type as QuestionType,
        displayMode: cycleDisplayMode,
      });
      return {
        questionId: q.id,
        textHe: q.textHe,
        textEn: q.textEn,
        ...summary,
        skipRate: computeSkipRate(summary.totalResponses, summary.skippedCount),
      };
    });

    return {
      surveyId,
      cycleId: cycle.id,
      state: cycle.state as CycleState,
      displayMode: cycleDisplayMode,
      totalRespondents,
      questions: questionSummaries,
    };
  }

  // --------------------------------------------------------------- /leaderboard

  /**
   * Top-50 opted-in respondents ordered by points desc, answeredCount desc.
   */
  async getLeaderboard(): Promise<LeaderboardResponse> {
    const respondents = await this.prisma.respondent.findMany({
      where: { showInLeaderboard: true },
      orderBy: [{ points: 'desc' }, { answeredCount: 'desc' }],
      take: 50,
      include: {
        badges: { select: { type: true } },
      },
    });

    return respondents.map((r, index) => ({
      position: index + 1,
      displayName: displayName({ nickname: r.nickname, id: r.id }),
      rank: rankForStats({ surveysCompleted: r.answeredCount, trustScore: r.trustScore }),
      badges: r.badges.map((b) => b.type),
      surveysCompleted: r.answeredCount,
      points: r.points,
    }));
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

type ResponseRow = {
  id: string;
  questionId: string;
  respondentId: string | null;
  answerValue: string | null;
  skipped: boolean;
  trustScoreAtSubmission: number;
  rawCounted: boolean;
};

function groupByQuestionId(responses: ResponseRow[]): Map<string, ResponseRow[]> {
  const map = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    const arr = map.get(r.questionId) ?? [];
    arr.push(r);
    map.set(r.questionId, arr);
  }
  return map;
}

function toResponseLikes(rows: ResponseRow[]): ResponseLike[] {
  return rows.map((r) => ({
    answerValue: r.answerValue ?? undefined,
    skipped: r.skipped,
    trustScore: r.trustScoreAtSubmission,
    rawCounted: r.rawCounted,
  }));
}

function countDistinctRespondents(responses: ResponseRow[]): number {
  const ids = new Set<string>();
  for (const r of responses) {
    if (r.respondentId) ids.add(r.respondentId);
  }
  return ids.size;
}

function computeSkipRate(totalResponses: number, skippedCount: number): number {
  const total = totalResponses + skippedCount;
  return total > 0 ? skippedCount / total : 0;
}
