import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/auth.decorators';
import { ResultsService } from './results.service';
import type { LeaderboardResponse } from '@mhm/contracts';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly resultsService: ResultsService) {}

  /**
   * GET /leaderboard
   * Public endpoint: top-50 opted-in respondents ordered by points desc, answeredCount desc.
   */
  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Top-50 public leaderboard' })
  getLeaderboard(): Promise<LeaderboardResponse> {
    return this.resultsService.getLeaderboard();
  }
}
