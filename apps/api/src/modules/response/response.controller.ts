import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { Principal } from '@mhm/shared';
import type { SubmitResponseResponse, AnsweredResponse } from '@mhm/contracts';

import { CurrentPrincipal } from '../../common/decorators/principal.decorator';

import { SubmitResponseDto, SkipDto } from './dto/response.dto';
import { ResponseService } from './response.service';

/**
 * Handles the core response submission flow:
 *   POST /responses       — record an answer
 *   POST /responses/skip  — skip a question
 */
@ApiTags('responses')
@Controller('responses')
export class ResponseController {
  constructor(private readonly responseService: ResponseService) {}

  /** Record an answer for a question. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit an answer to a question' })
  @ApiOkResponse({ description: 'Answer accepted; gamification result returned' })
  submit(
    @Body() dto: SubmitResponseDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SubmitResponseResponse> {
    return this.responseService.submit(dto, principal);
  }

  /** Skip a question without answering. */
  @Post('skip')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Skip a question' })
  @ApiOkResponse({ description: 'Skip recorded; gamification result returned' })
  skip(
    @Body() dto: SkipDto,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SubmitResponseResponse> {
    return this.responseService.skip(dto, principal);
  }
}

/**
 * Handles the respondent's answered-question list:
 *   GET /respondent/answered
 */
@ApiTags('respondent')
@Controller('respondent')
export class RespondentAnsweredController {
  constructor(private readonly responseService: ResponseService) {}

  /** List all questions the authenticated respondent has interacted with. */
  @Get('answered')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all questions already answered or skipped' })
  @ApiOkResponse({ description: 'Array of answered/skipped question entries' })
  getAnswered(
    @CurrentPrincipal() principal: Principal,
  ): Promise<AnsweredResponse> {
    return this.responseService.getAnswered(principal.respondentId ?? '');
  }
}
