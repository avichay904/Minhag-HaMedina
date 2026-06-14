import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { CycleService } from './cycle.service';
import { CycleController } from './cycle.controller';
import { CYCLE_SERVICE } from '../../common/facades';

/**
 * Owner: Worker C (Survey & Cycle).
 * Provides the CYCLE_SERVICE token (bound to CycleService) for consumption by
 * SurveyModule and any other module that imports CycleModule.
 */
@Module({
  imports: [GamificationModule],
  controllers: [CycleController],
  providers: [
    CycleService,
    { provide: CYCLE_SERVICE, useExisting: CycleService },
  ],
  exports: [CycleService, CYCLE_SERVICE],
})
export class CycleModule {}
