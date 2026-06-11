import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { GamificationModule } from '../gamification/gamification.module';

import { RespondentController } from './respondent.controller';
import { RespondentService } from './respondent.service';

@Module({
  imports: [PrismaModule, GamificationModule],
  controllers: [RespondentController],
  providers: [RespondentService],
})
export class RespondentModule {}
