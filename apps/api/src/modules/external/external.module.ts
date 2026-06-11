import { Module } from '@nestjs/common';

// Owner: Worker B (External + Source Registry).
// Add: external.controller.ts, external.service.ts, source-registry.service.ts, dto/.
// Provides /external/register, PATCH /external/respondent/:id, /external/results. Exports SourceGuard usage.
@Module({})
export class ExternalModule {}
