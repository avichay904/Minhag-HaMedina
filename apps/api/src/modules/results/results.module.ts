import { Module } from '@nestjs/common';

// Owner: Worker G (Results & Leaderboard).
// Add: results.controller.ts, results.service.ts, dto/. Provides GET /results/:surveyId,
// /results/:surveyId/public, /leaderboard (and feeds /external/results). Uses @mhm/shared results.
@Module({})
export class ResultsModule {}
