import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { QuestionDto } from '@mhm/contracts';

import { Public } from '../../common/decorators/auth.decorators';
import { AdminGuard } from '../../common/guards/admin.guard';

import { QuestionService } from './question.service';
import { CreateQuestionDto } from './dto/question.dto';

@ApiTags('questions')
@Controller('questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  /**
   * Create a new survey question.
   *
   * Admin-only. Marked @Public so the global JWT guard steps aside;
   * AdminGuard then enforces admin privileges (admin JWT or static token).
   * Zod schema enforces bilingual text, scale bounds, and ≥2 options for
   * SINGLE_CHOICE. Service adds scaleMin < scaleMax and option-key uniqueness.
   */
  @Public()
  @UseGuards(AdminGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a survey question (admin only)' })
  @ApiCreatedResponse({ description: 'The created question' })
  createQuestion(@Body() dto: CreateQuestionDto): Promise<QuestionDto> {
    return this.questionService.createQuestion(dto);
  }
}
