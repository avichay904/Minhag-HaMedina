import { Injectable } from '@nestjs/common';
import { evaluateBadges } from '@mhm/shared';
import type { BadgeStats, BadgeType } from '@mhm/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class BadgeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates which badges the respondent qualifies for, persists any newly-earned
   * badges (ignoring duplicates via unique constraint), and returns the set that
   * was added in this call.
   */
  async awardNewBadges(respondentId: string, stats: BadgeStats): Promise<BadgeType[]> {
    const earned: BadgeType[] = evaluateBadges(stats);

    if (earned.length === 0) return [];

    // Load already-held badges to compute the delta.
    const existing = await this.prisma.respondentBadge.findMany({
      where: { respondentId },
      select: { type: true },
    });
    const existingSet = new Set(existing.map((b) => b.type as BadgeType));

    const newBadges = earned.filter((b) => !existingSet.has(b));
    if (newBadges.length === 0) return [];

    // Persist them; skip on unique-constraint violation rather than failing.
    await Promise.all(
      newBadges.map((type) =>
        this.prisma.respondentBadge
          .create({ data: { respondentId, type } })
          .catch(() => {
            // Race condition: another request already persisted this badge — safe to ignore.
          }),
      ),
    );

    return newBadges;
  }

  async getBadgeTypes(respondentId: string): Promise<BadgeType[]> {
    const rows = await this.prisma.respondentBadge.findMany({
      where: { respondentId },
      select: { type: true },
    });
    return rows.map((r) => r.type as BadgeType);
  }
}
