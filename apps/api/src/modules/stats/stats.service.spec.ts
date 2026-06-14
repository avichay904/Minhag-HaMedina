import { describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';

import { StatsService } from './stats.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockPrisma(answeredCount: number, distinctRespondents: { respondentId: string }[]) {
  return {
    response: {
      count: vi.fn().mockResolvedValue(answeredCount),
      findMany: vi.fn().mockResolvedValue(distinctRespondents),
    },
  };
}

async function buildService(
  answeredCount: number,
  distinctRespondents: { respondentId: string }[],
): Promise<StatsService> {
  const prisma = makeMockPrisma(answeredCount, distinctRespondents);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StatsService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();

  return module.get(StatsService);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatsService.getCommunityStats', () => {
  it('returns correct counts when there are responses today', async () => {
    const service = await buildService(42, [
      { respondentId: 'r1' },
      { respondentId: 'r2' },
      { respondentId: 'r3' },
    ]);

    const result = await service.getCommunityStats();

    expect(result.answeredToday).toBe(42);
    expect(result.respondentsToday).toBe(3);
  });

  it('returns zero counts when no responses today', async () => {
    const service = await buildService(0, []);

    const result = await service.getCommunityStats();

    expect(result.answeredToday).toBe(0);
    expect(result.respondentsToday).toBe(0);
  });
});
