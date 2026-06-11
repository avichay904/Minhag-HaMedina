import { Module } from '@nestjs/common';

// Owner: Worker C (Survey & Cycle).
// Add: survey.controller.ts, survey.service.ts, dto/. Provides /surveys/active, /surveys/:id/questions.
// May import QuestionModule (servable filtering) and CycleModule.
@Module({})
export class SurveyModule {}
