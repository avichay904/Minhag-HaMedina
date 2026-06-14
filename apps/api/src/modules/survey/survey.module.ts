import { Module } from '@nestjs/common';
import { QuestionModule } from '../question/question.module';
import { CycleModule } from '../cycle/cycle.module';
import { SurveyService } from './survey.service';
import { SurveyController } from './survey.controller';

/**
 * Owner: Worker C (Survey & Cycle).
 * Provides GET /surveys/active and GET /surveys/:id/questions.
 * Also exposes POST /surveys/:id/cycles (admin) by delegating to CycleService.
 *
 * Imports:
 *  - QuestionModule  → makes QUESTION_SERVICE injectable here
 *  - CycleModule     → makes CycleService + CYCLE_SERVICE injectable here
 */
@Module({
  imports: [QuestionModule, CycleModule],
  controllers: [SurveyController],
  providers: [SurveyService],
})
export class SurveyModule {}
