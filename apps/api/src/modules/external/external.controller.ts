import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ExternalSource } from '@prisma/client';
import { Public } from '../../common/decorators/auth.decorators';
import { SourceGuard } from '../../common/guards/source.guard';
import { ExternalService } from './external.service';
import { CurrentSource } from './decorators/current-source.decorator';
import {
  ExternalRegisterRequestDto,
  ExternalRespondentUpdateDto,
} from './dto/external.dto';
import type { SurveyResults } from '@mhm/contracts';

/**
 * External Source Registry endpoints (SRS §7).
 *
 * All routes are @Public (skipping the global JWT AuthGuard) and then
 * re-authenticated via @UseGuards(SourceGuard) which validates the API key and
 * attaches `request.source`.
 */
@Controller('external')
export class ExternalController {
  constructor(private readonly externalService: ExternalService) {}

  /**
   * POST /external/register
   * Register a new respondent on behalf of an external source.
   * Returns a respondent JWT the external user can use for response submission.
   */
  @Post('register')
  @Public()
  @UseGuards(SourceGuard)
  @HttpCode(HttpStatus.CREATED)
  async register(
    @CurrentSource() source: ExternalSource,
    @Body() dto: ExternalRegisterRequestDto,
  ): Promise<{ respondentId: string; token: string }> {
    return this.externalService.registerRespondent(source, dto);
  }

  /**
   * PATCH /external/respondent/:id
   * Update demographics / preferredLanguage for a respondent owned by this source.
   */
  @Patch('respondent/:id')
  @Public()
  @UseGuards(SourceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateRespondent(
    @CurrentSource() source: ExternalSource,
    @Param('id') respondentId: string,
    @Body() dto: ExternalRespondentUpdateDto,
  ): Promise<void> {
    await this.externalService.updateRespondent(source, respondentId, dto);
  }

  /**
   * GET /external/results
   * Retrieve aggregated survey results scoped to this source's respondents
   * (subject to resultsScope.categories and resultsScope.ownRespondentsOnly).
   */
  @Get('results')
  @Public()
  @UseGuards(SourceGuard)
  async getResults(@CurrentSource() source: ExternalSource): Promise<SurveyResults[]> {
    return this.externalService.getResults(source);
  }
}
