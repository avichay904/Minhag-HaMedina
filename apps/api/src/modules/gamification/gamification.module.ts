import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { GAMIFICATION_SERVICE } from '../../common/facades';

import { RankService } from './rank.service';
import { BadgeService } from './badge.service';
import { ChallengeService } from './challenge.service';
import { GamificationService } from './gamification.service';

@Module({
  imports: [PrismaModule],
  providers: [
    RankService,
    BadgeService,
    ChallengeService,
    GamificationService,
    { provide: GAMIFICATION_SERVICE, useExisting: GamificationService },
  ],
  exports: [GAMIFICATION_SERVICE],
})
export class GamificationModule {}
