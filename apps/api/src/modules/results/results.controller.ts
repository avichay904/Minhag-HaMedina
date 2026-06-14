import { Controller, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ResultsService } from './results.service';
import type { SurveyResults } from '@mhm/contracts';

@ApiTags('results')
@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  /**
   * GET /results/:surveyId
   * Admin-only endpoint: returns raw + weighted aggregates in real time for the
   * survey's latest cycle, regardless of cycle state.
   */
  @Public()
  @UseGuards(AdminGuard)
  @Get(':surveyId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin results for a survey (real-time, any cycle state)' })
  getAdminResults(@Param('surveyId') surveyId: string): Promise<SurveyResults> {
    return this.resultsService.getAdminResults(surveyId);
  }

  /**
   * GET /results/:surveyId/public
   * Public endpoint: only returns results when the latest cycle is APPROVED or PUBLISHED.
   * Respects the cycle's displayMode.
   */
  @Public()
  @Get(':surveyId/public')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public results for a survey (only when approved/published)' })
  getPublicResults(@Param('surveyId') surveyId: string): Promise<SurveyResults> {
    return this.resultsService.getPublicResults(surveyId);
  }
}
