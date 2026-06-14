import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { QuestionDto, SurveyDto, AdminSurveyDto, AdminCycleRow } from '@mhm/contracts';
import type { Language, RespondentContext } from '@mhm/shared';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Public } from '../../common/decorators/auth.decorators';
import { CurrentPrincipal } from '../../common/decorators/principal.decorator';
import type { Principal } from '@mhm/shared';
import { QUESTION_SERVICE, IQuestionService } from '../../common/facades';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SurveyService } from './survey.service';
import { CycleService } from '../cycle/cycle.service';
import { CreateSurveyDto } from './dto/survey.dto';

@ApiTags('surveys')
@Controller('surveys')
export class SurveyController {
  constructor(
    private readonly surveyService: SurveyService,
    private readonly cycleService: CycleService,
    private readonly prisma: PrismaService,
    @Inject(QUESTION_SERVICE)
    private readonly questionService: IQuestionService,
  ) {}

  /**
   * GET /surveys/active
   * Returns all active surveys enriched with cycle summary and question count.
   * Requires authentication (any respondent JWT).
   */
  @Get('active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List active surveys with cycle info and question count' })
  @ApiOkResponse({ description: 'Active survey list' })
  getActiveSurveys(): Promise<SurveyDto[]> {
    return this.surveyService.getActiveSurveys();
  }

  /**
   * GET /surveys/:id/questions
   * Returns servable questions for the authenticated respondent.
   * Targeting + never-repeat filtering are handled inside QuestionService.
   */
  @Get(':id/questions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get servable questions for a survey (respondent-filtered)' })
  @ApiOkResponse({ description: 'Filtered question list' })
  async getSurveyQuestions(
    @Param('id') surveyId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<QuestionDto[]> {
    // Resolve the respondent's demographics for targeting.
    const respondent = principal.respondentId
      ? await this.prisma.respondent.findUnique({
          where: { id: principal.respondentId },
          select: { age: true, gender: true, region: true, preferredLanguage: true },
        })
      : null;

    const ctx: RespondentContext = {
      age: respondent?.age ?? null,
      gender: respondent?.gender ?? null,
      region: respondent?.region ?? null,
      language: (respondent?.preferredLanguage ?? 'HE') as Language,
      trustScore: principal.trustScore,
    };

    // Collect the set of question ids the respondent has already answered / skipped.
    const answeredRows = principal.respondentId
      ? await this.prisma.response.findMany({
          where: { respondentId: principal.respondentId },
          select: { questionId: true },
        })
      : [];

    const answeredQuestionIds = answeredRows.map((r) => r.questionId);

    return this.questionService.getServableQuestions({ surveyId, ctx, answeredQuestionIds });
  }

  // ---------------------------------------------------------------------------
  // Admin: create a survey
  // ---------------------------------------------------------------------------

  /**
   * POST /surveys
   * Creates a new survey (admin only).
   * Note: NestJS matches more-specific static segments (/active) before params (:id).
   * POST /surveys does not collide with GET /surveys/active or GET /surveys/:id/questions.
   */
  @Public()
  @UseGuards(AdminGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a survey (admin)' })
  @ApiCreatedResponse({ description: 'The created survey' })
  createSurvey(@Body() dto: CreateSurveyDto): Promise<SurveyDto> {
    return this.surveyService.createSurvey(dto);
  }

  // ---------------------------------------------------------------------------
  // Admin: list all surveys with cycles + question counts
  // ---------------------------------------------------------------------------

  /**
   * GET /surveys
   * Returns ALL surveys (active and inactive) with cycles and question counts (admin only).
   * NestJS resolves /surveys/active first (static segment wins), so no collision.
   */
  @Public()
  @UseGuards(AdminGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all surveys with cycles and question counts (admin)' })
  @ApiOkResponse({ description: 'Admin survey list' })
  listSurveys(): Promise<AdminSurveyDto[]> {
    return this.surveyService.listAllSurveys();
  }

  // ---------------------------------------------------------------------------
  // Admin: list cycles for a survey
  // ---------------------------------------------------------------------------

  /**
   * GET /surveys/:id/cycles
   * Returns all cycles for a given survey (admin only).
   */
  @Public()
  @UseGuards(AdminGuard)
  @Get(':id/cycles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List cycles for a survey (admin)' })
  @ApiOkResponse({ description: 'Cycle list for survey' })
  async listCycles(@Param('id') surveyId: string): Promise<AdminCycleRow[]> {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException(`Survey ${surveyId} not found`);
    return this.surveyService.listSurveyCycles(surveyId);
  }

  // ---------------------------------------------------------------------------
  // Admin: open a new cycle for a survey
  // ---------------------------------------------------------------------------

  /**
   * POST /surveys/:id/cycles
   * Opens a new cycle for the given survey (admin only).
   */
  @Public()
  @UseGuards(AdminGuard)
  @Post(':id/cycles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Open a new cycle for a survey (admin)' })
  async openCycle(@Param('id') surveyId: string) {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException(`Survey ${surveyId} not found`);
    return this.cycleService.openCycle(surveyId);
  }
}
