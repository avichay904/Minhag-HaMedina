import { Module } from '@nestjs/common';
import { ExternalController } from './external.controller';
import { ExternalService } from './external.service';
import { AdminSourceController } from './admin-source.controller';
import { AdminSourceService } from './admin-source.service';
import { SourceGuard } from '../../common/guards/source.guard';

/**
 * External Source Registry module (SRS §7).
 *
 * Handles:
 *  - POST /external/register         — register respondents via an external source
 *  - PATCH /external/respondent/:id  — update respondent demographics
 *  - GET /external/results           — retrieve scoped aggregated results
 *
 * Admin source registry (all require @Public() + @UseGuards(AdminGuard)):
 *  - GET /sources                    — list all ExternalSource records
 *  - POST /sources                   — create a new source (returns raw apiKey once)
 *  - PATCH /sources/:id              — update a source's permissions / active flag
 *
 * PrismaService is globally provided (PrismaModule is @Global), so SourceGuard
 * can be registered here and still resolve its PrismaService dependency.
 */
@Module({
  controllers: [ExternalController, AdminSourceController],
  providers: [ExternalService, AdminSourceService, SourceGuard],
})
export class ExternalModule {}
