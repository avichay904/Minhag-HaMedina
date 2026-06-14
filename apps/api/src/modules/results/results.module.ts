import { Module } from '@nestjs/common';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { LeaderboardController } from './leaderboard.controller';

// Owner: Worker G (Results & Leaderboard).
// PrismaService is provided by the global PrismaModule registered in AppModule.
@Module({
  controllers: [ResultsController, LeaderboardController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
