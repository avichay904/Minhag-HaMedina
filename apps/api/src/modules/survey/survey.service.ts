import { Inject, Injectable } from '@nestjs/common';
import type { Cadence } from '@mhm/shared';
import type { SurveyDto, CycleSummary, AdminSurveyDto, AdminCycleRow, CreateSurveyRequest } from '@mhm/contracts';
import type {
  ICycleService,
  IQuestionService,
  CycleInfo,
} from '../../common/facades';
import { CYCLE_SERVICE, QUESTION_SERVICE } from '../../common/facades';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SurveyService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CYCLE_SERVICE)
    private readonly cycleService: ICycleService,
    @Inject(QUESTION_SERVICE)
    private readonly questionService: IQuestionService,
  ) {}

  /**
   * Returns all active surveys, each enriched with:
   *  - activeCycle: the current OPEN cycle mapped to CycleSummary, or null.
   *  - questionCount: number of currently active questions in the survey.
   */
  async getActiveSurveys(): Promise<SurveyDto[]> {
    const surveys = await this.prisma.survey.findMany({
      where: { active: true },
    });

    const results = await Promise.all(
      surveys.map(async (survey) => {
        const [cycle, questionCount] = await Promise.all([
          this.cycleService.getActiveCycle(survey.id),
          this.questionService.countActiveQuestions(survey.id),
        ]);

        const dto: SurveyDto = {
          id: survey.id,
          titleHe: survey.titleHe,
          titleEn: survey.titleEn,
          cadence: survey.cadence,
          activeCycle: cycle ? this.mapCycleSummary(cycle) : null,
          questionCount,
        };

        return dto;
      }),
    );

    return results;
  }

  // ---------------------------------------------------------------------------
  // Admin: create a survey
  // ---------------------------------------------------------------------------

  async createSurvey(dto: CreateSurveyRequest): Promise<SurveyDto> {
    const survey = await this.prisma.survey.create({
      data: {
        titleHe: dto.titleHe,
        titleEn: dto.titleEn,
        cadence: (dto.cadence ?? 'WEEKLY') as Cadence,
        active: true,
      },
    });

    return {
      id: survey.id,
      titleHe: survey.titleHe,
      titleEn: survey.titleEn,
      cadence: survey.cadence as Cadence,
      activeCycle: null,
      questionCount: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Admin: list all surveys with cycles + question counts
  // ---------------------------------------------------------------------------

  async listAllSurveys(): Promise<AdminSurveyDto[]> {
    const surveys = await this.prisma.survey.findMany({
      include: {
        cycles: {
          orderBy: { sequence: 'asc' },
        },
        _count: { select: { questions: { where: { active: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return surveys.map((survey) => ({
      id: survey.id,
      titleHe: survey.titleHe,
      titleEn: survey.titleEn,
      cadence: survey.cadence as Cadence,
      active: survey.active,
      questionCount: survey._count.questions,
      cycles: survey.cycles.map((c) => this.mapAdminCycleRow(c)),
    }));
  }

  // ---------------------------------------------------------------------------
  // Admin: list cycles for a single survey
  // ---------------------------------------------------------------------------

  async listSurveyCycles(surveyId: string): Promise<AdminCycleRow[]> {
    const cycles = await this.prisma.surveyCycle.findMany({
      where: { surveyId },
      orderBy: { sequence: 'asc' },
    });

    return cycles.map((c) => this.mapAdminCycleRow(c));
  }

  // ---------------------------------------------------------------------------
  // Mapping helpers
  // ---------------------------------------------------------------------------

  private mapCycleSummary(cycle: CycleInfo): CycleSummary {
    return {
      id: cycle.id,
      state: cycle.state,
      openedAt: cycle.openedAt.toISOString(),
      closedAt: cycle.closedAt ? cycle.closedAt.toISOString() : null,
      publishedAt: cycle.publishedAt ? cycle.publishedAt.toISOString() : null,
    };
  }

  private mapAdminCycleRow(c: {
    id: string;
    sequence: number;
    state: string;
    openedAt: Date;
    closedAt: Date | null;
    publishedAt: Date | null;
    displayMode: string;
  }): AdminCycleRow {
    return {
      id: c.id,
      sequence: c.sequence,
      state: c.state as AdminCycleRow['state'],
      openedAt: c.openedAt.toISOString(),
      closedAt: c.closedAt ? c.closedAt.toISOString() : null,
      publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
      displayMode: c.displayMode as AdminCycleRow['displayMode'],
    };
  }
}
