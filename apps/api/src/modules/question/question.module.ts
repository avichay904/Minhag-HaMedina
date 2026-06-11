import { Module } from '@nestjs/common';

// Owner: Worker D (Question & Targeting).
// Add: question.controller.ts, question.service.ts, dto/. Provides POST /questions (Admin).
// Export QuestionService (servable-question assembly via @mhm/shared selection) for SurveyModule.
@Module({})
export class QuestionModule {}
