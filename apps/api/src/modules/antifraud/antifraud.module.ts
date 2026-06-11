import { Module } from '@nestjs/common';

// Owner: Worker E (Response & Anti-fraud).
// Add: antifraud.service.ts (fingerprint/rate-limit/anomaly flagging — flag, never delete).
// MUST export AntifraudService (consumed by ResponseModule).
@Module({})
export class AntifraudModule {}
