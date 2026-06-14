import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';

/** Health/liveness probe module (public GET /health). */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
