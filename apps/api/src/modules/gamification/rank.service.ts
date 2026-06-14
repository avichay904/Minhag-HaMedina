import { Injectable } from '@nestjs/common';
import { rankForStats, rankProgress } from '@mhm/shared';
import type { Rank, RankProgress } from '@mhm/shared';

@Injectable()
export class RankService {
  forStats(surveysCompleted: number, trustScore: number): Rank {
    return rankForStats({ surveysCompleted, trustScore });
  }

  progress(surveysCompleted: number, trustScore: number): RankProgress {
    return rankProgress({ surveysCompleted, trustScore });
  }
}
