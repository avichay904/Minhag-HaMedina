import { Inject, Injectable } from '@nestjs/common';
import type { SurveyDto, CycleSummary } from '@mhm/contracts';
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
}
