import { Module } from '@nestjs/common';

import { GamificationModule } from '../gamification/gamification.module';
import { PowModule } from '../pow/pow.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [GamificationModule, PowModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
