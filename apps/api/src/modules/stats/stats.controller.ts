import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CommunityStatsResponse } from '@mhm/contracts';
import { Public } from '../../common/decorators/auth.decorators';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  /**
   * GET /stats/community
   * Public endpoint: today's response and respondent counts.
   */
  @Public()
  @Get('community')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get community activity stats for today' })
  @ApiOkResponse({ description: 'Counts of non-skipped responses and distinct respondents today' })
  getCommunityStats(): Promise<CommunityStatsResponse> {
    return this.statsService.getCommunityStats();
  }
}
