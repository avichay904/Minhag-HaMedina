import { Module } from '@nestjs/common';

import { ANTIFRAUD_SERVICE } from '../../common/facades';

import { AntifraudService } from './antifraud.service';

/**
 * Antifraud module — flags anomalous submissions (never blocks or deletes).
 *
 * Exports ANTIFRAUD_SERVICE token so any module that imports AntifraudModule
 * can inject the service via @Inject(ANTIFRAUD_SERVICE).
 */
@Module({
  providers: [
    AntifraudService,
    { provide: ANTIFRAUD_SERVICE, useExisting: AntifraudService },
  ],
  exports: [ANTIFRAUD_SERVICE],
})
export class AntifraudModule {}
