import { Module } from '@nestjs/common';

import { GamificationModule } from '../gamification/gamification.module';
import { CycleModule } from '../cycle/cycle.module';
import { AntifraudModule } from '../antifraud/antifraud.module';

import { ResponseController, RespondentAnsweredController } from './response.controller';
import { ResponseService } from './response.service';

/**
 * Response module — handles:
 *   POST /responses        submit an answer
 *   POST /responses/skip   skip a question
 *   GET  /respondent/answered  list already-answered questions
 *
 * Depends on:
 *  - GamificationModule  (GAMIFICATION_SERVICE)
 *  - CycleModule         (CYCLE_SERVICE)
 *  - AntifraudModule     (ANTIFRAUD_SERVICE)
 *  - PrismaModule        (global)
 */
@Module({
  imports: [GamificationModule, CycleModule, AntifraudModule],
  controllers: [ResponseController, RespondentAnsweredController],
  providers: [ResponseService],
})
export class ResponseModule {}
