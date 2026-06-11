import { Module } from '@nestjs/common';
import { ExternalController } from './external.controller';
import { ExternalService } from './external.service';
import { SourceGuard } from '../../common/guards/source.guard';

/**
 * External Source Registry module (SRS §7).
 *
 * Handles:
 *  - POST /external/register   — register respondents via an external source
 *  - PATCH /external/respondent/:id — update respondent demographics
 *  - GET /external/results     — retrieve scoped aggregated results
 *
 * PrismaService is globally provided (PrismaModule is @Global), so SourceGuard
 * can be registered here and still resolve its PrismaService dependency.
 */
@Module({
  controllers: [ExternalController],
  providers: [ExternalService, SourceGuard],
})
export class ExternalModule {}
