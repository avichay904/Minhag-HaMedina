import { Module } from '@nestjs/common';

// Owner: Worker E (Response & Anti-fraud).
// Add: response.controller.ts, response.service.ts, dto/. Provides POST /responses,
// POST /responses/skip, GET /respondent/answered. Imports GamificationModule + AntifraudModule.
@Module({})
export class ResponseModule {}
