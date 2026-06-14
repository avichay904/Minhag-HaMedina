import { Injectable } from '@nestjs/common';
import type { CommunityStatsResponse } from '@mhm/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns aggregate counts for today (UTC midnight → now):
   *   - answeredToday: non-skipped responses recorded today
   *   - respondentsToday: distinct respondents (with respondentId) who answered today
   */
  async getCommunityStats(): Promise<CommunityStatsResponse> {
    const todayMidnightUtc = new Date();
    todayMidnightUtc.setUTCHours(0, 0, 0, 0);

    const [answeredCount, distinctRespondents] = await Promise.all([
      this.prisma.response.count({
        where: {
          skipped: false,
          answeredAt: { gte: todayMidnightUtc },
        },
      }),
      this.prisma.response.findMany({
        where: {
          skipped: false,
          answeredAt: { gte: todayMidnightUtc },
          respondentId: { not: null },
        },
        select: { respondentId: true },
        distinct: ['respondentId'],
      }),
    ]);

    return {
      answeredToday: answeredCount,
      respondentsToday: distinctRespondents.length,
    };
  }
}
