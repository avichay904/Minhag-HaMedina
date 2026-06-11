import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CycleState, DisplayMode } from '@mhm/shared';
import { CycleService } from './cycle.service';
import {
  GAMIFICATION_SERVICE,
  type IGamificationService,
  type CycleInfo,
} from '../../common/facades';
import { PrismaService } from '../../common/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal SurveyCycle row as Prisma would return it. */
function makeCycleRow(overrides: Partial<{
  id: string;
  surveyId: string;
  sequence: number;
  state: string;
  displayMode: string;
  openedAt: Date;
  closedAt: Date | null;
  publishedAt: Date | null;
  approvedById: string | null;
  createdAt: Date;
}> = {}) {
  return {
    id: 'cycle-1',
    surveyId: 'survey-1',
    sequence: 1,
    state: CycleState.OPEN,
    displayMode: DisplayMode.BOTH,
    openedAt: new Date('2024-01-01T00:00:00Z'),
    closedAt: null,
    publishedAt: null,
    approvedById: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

function makePrismaMock() {
  return {
    surveyCycle: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    question: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CycleService', () => {
  let service: CycleService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let gamification: IGamificationService;

  beforeEach(async () => {
    prisma = makePrismaMock();
    gamification = {
      generateChallengeForCycle: vi.fn().mockResolvedValue(undefined),
      onResponseRecorded: vi.fn(),
      getProfileGamification: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CycleService,
        { provide: PrismaService, useValue: prisma },
        { provide: GAMIFICATION_SERVICE, useValue: gamification },
      ],
    }).compile();

    service = moduleRef.get(CycleService);
  });

  // -------------------------------------------------------------------------
  // openCycle
  // -------------------------------------------------------------------------

  describe('openCycle', () => {
    it('creates a cycle with sequence = maxExistingSequence + 1', async () => {
      vi.mocked(prisma.surveyCycle.aggregate).mockResolvedValue({ _max: { sequence: 3 } } as never);
      const created = makeCycleRow({ sequence: 4, state: CycleState.OPEN });
      vi.mocked(prisma.surveyCycle.create).mockResolvedValue(created as never);

      const result = await service.openCycle('survey-1');

      expect(prisma.surveyCycle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            surveyId: 'survey-1',
            sequence: 4,
            state: CycleState.OPEN,
          }),
        }),
      );
      expect(result.sequence).toBe(4);
      expect(result.state).toBe(CycleState.OPEN);
    });

    it('uses sequence = 1 when no prior cycles exist', async () => {
      vi.mocked(prisma.surveyCycle.aggregate).mockResolvedValue({ _max: { sequence: null } } as never);
      const created = makeCycleRow({ sequence: 1, state: CycleState.OPEN });
      vi.mocked(prisma.surveyCycle.create).mockResolvedValue(created as never);

      const result = await service.openCycle('survey-1');

      expect(prisma.surveyCycle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sequence: 1 }),
        }),
      );
      expect(result.sequence).toBe(1);
    });

    it('calls gamification.generateChallengeForCycle with the new cycle id', async () => {
      vi.mocked(prisma.surveyCycle.aggregate).mockResolvedValue({ _max: { sequence: 0 } } as never);
      const created = makeCycleRow({ id: 'new-cycle-id', sequence: 1 });
      vi.mocked(prisma.surveyCycle.create).mockResolvedValue(created as never);

      await service.openCycle('survey-1');

      expect(gamification.generateChallengeForCycle).toHaveBeenCalledOnce();
      expect(gamification.generateChallengeForCycle).toHaveBeenCalledWith('new-cycle-id');
    });

    it('returns a CycleInfo with dates mapped correctly', async () => {
      vi.mocked(prisma.surveyCycle.aggregate).mockResolvedValue({ _max: { sequence: 0 } } as never);
      const openedAt = new Date('2024-06-01T10:00:00Z');
      const created = makeCycleRow({ sequence: 1, openedAt });
      vi.mocked(prisma.surveyCycle.create).mockResolvedValue(created as never);

      const result = await service.openCycle('survey-1');

      expect(result.openedAt).toEqual(openedAt);
      expect(result.closedAt).toBeNull();
      expect(result.publishedAt).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // closeCycle
  // -------------------------------------------------------------------------

  describe('closeCycle', () => {
    it('throws NotFoundException when cycle does not exist', async () => {
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(null);

      await expect(service.closeCycle('ghost-cycle')).rejects.toThrow(NotFoundException);
    });

    it('sets state = CLOSED and closedAt on the cycle', async () => {
      const existing = makeCycleRow({ sequence: 5 });
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(existing as never);
      const closed = makeCycleRow({ state: CycleState.CLOSED, closedAt: new Date() });
      vi.mocked(prisma.surveyCycle.update).mockResolvedValue(closed as never);
      vi.mocked(prisma.question.findMany).mockResolvedValue([] as never);

      const result = await service.closeCycle('cycle-1');

      expect(prisma.surveyCycle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cycle-1' },
          data: expect.objectContaining({ state: CycleState.CLOSED }),
        }),
      );
      expect(result.state).toBe(CycleState.CLOSED);
    });

    it('deactivates questions whose lifespan is exhausted', async () => {
      // cycle sequence = 5; question startCycleSequence = 1, expiresAfterCycles = 4
      // 5 - 1 = 4 >= 4 → expired
      const existing = makeCycleRow({ sequence: 5, surveyId: 'survey-1' });
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.surveyCycle.update).mockResolvedValue(
        makeCycleRow({ state: CycleState.CLOSED, closedAt: new Date() }) as never,
      );

      vi.mocked(prisma.question.findMany).mockResolvedValue([
        { id: 'q-expired', startCycleSequence: 1, expiresAfterCycles: 4 },
        { id: 'q-still-active', startCycleSequence: 3, expiresAfterCycles: 4 },
      ] as never);

      await service.closeCycle('cycle-1');

      expect(prisma.question.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['q-expired'] } },
        data: { active: false },
      });
    });

    it('does not call question.updateMany when no questions expire', async () => {
      const existing = makeCycleRow({ sequence: 2 });
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.surveyCycle.update).mockResolvedValue(
        makeCycleRow({ state: CycleState.CLOSED }) as never,
      );
      vi.mocked(prisma.question.findMany).mockResolvedValue([
        { id: 'q-young', startCycleSequence: 1, expiresAfterCycles: 5 },
      ] as never);

      await service.closeCycle('cycle-1');

      expect(prisma.question.updateMany).not.toHaveBeenCalled();
    });

    it('does not call question.updateMany when survey has no expiring questions', async () => {
      const existing = makeCycleRow({ sequence: 10 });
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.surveyCycle.update).mockResolvedValue(
        makeCycleRow({ state: CycleState.CLOSED }) as never,
      );
      vi.mocked(prisma.question.findMany).mockResolvedValue([] as never);

      await service.closeCycle('cycle-1');

      expect(prisma.question.updateMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // approveCycle
  // -------------------------------------------------------------------------

  describe('approveCycle', () => {
    it('throws NotFoundException when cycle does not exist', async () => {
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(null);

      await expect(service.approveCycle('ghost')).rejects.toThrow(NotFoundException);
    });

    it('sets state = APPROVED and records the approver', async () => {
      const existing = makeCycleRow({ state: CycleState.CLOSED });
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(existing as never);
      const approved = makeCycleRow({
        state: CycleState.APPROVED,
        approvedById: 'admin-1',
        publishedAt: new Date(),
      });
      vi.mocked(prisma.surveyCycle.update).mockResolvedValue(approved as never);

      const result = await service.approveCycle('cycle-1', 'admin-1');

      expect(prisma.surveyCycle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            state: CycleState.APPROVED,
            approvedById: 'admin-1',
          }),
        }),
      );
      expect(result.state).toBe(CycleState.APPROVED);
    });

    it('preserves existing publishedAt if already set', async () => {
      const existingPublishedAt = new Date('2024-03-01T00:00:00Z');
      const existing = makeCycleRow({ state: CycleState.CLOSED, publishedAt: existingPublishedAt });
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.surveyCycle.update).mockResolvedValue(
        makeCycleRow({ state: CycleState.APPROVED, publishedAt: existingPublishedAt }) as never,
      );

      await service.approveCycle('cycle-1');

      expect(prisma.surveyCycle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ publishedAt: existingPublishedAt }),
        }),
      );
    });

    it('works without an adminId (approvedById set to null)', async () => {
      const existing = makeCycleRow({ state: CycleState.CLOSED });
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.surveyCycle.update).mockResolvedValue(
        makeCycleRow({ state: CycleState.APPROVED }) as never,
      );

      await expect(service.approveCycle('cycle-1')).resolves.toBeDefined();
      expect(prisma.surveyCycle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ approvedById: null }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // publishCycle
  // -------------------------------------------------------------------------

  describe('publishCycle', () => {
    it('throws NotFoundException when cycle does not exist', async () => {
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(null);

      await expect(service.publishCycle('ghost')).rejects.toThrow(NotFoundException);
    });

    it('sets state = PUBLISHED', async () => {
      const existing = makeCycleRow({ state: CycleState.APPROVED });
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(existing as never);
      const published = makeCycleRow({ state: CycleState.PUBLISHED, publishedAt: new Date() });
      vi.mocked(prisma.surveyCycle.update).mockResolvedValue(published as never);

      const result = await service.publishCycle('cycle-1');

      expect(result.state).toBe(CycleState.PUBLISHED);
    });

    it('preserves existing publishedAt if already set', async () => {
      const existingPublishedAt = new Date('2024-04-01T00:00:00Z');
      const existing = makeCycleRow({ state: CycleState.APPROVED, publishedAt: existingPublishedAt });
      vi.mocked(prisma.surveyCycle.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.surveyCycle.update).mockResolvedValue(
        makeCycleRow({ state: CycleState.PUBLISHED, publishedAt: existingPublishedAt }) as never,
      );

      await service.publishCycle('cycle-1');

      expect(prisma.surveyCycle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ publishedAt: existingPublishedAt }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getActiveCycle
  // -------------------------------------------------------------------------

  describe('getActiveCycle', () => {
    it('returns null when no OPEN cycle exists for the survey', async () => {
      vi.mocked(prisma.surveyCycle.findFirst).mockResolvedValue(null);

      const result = await service.getActiveCycle('survey-1');

      expect(result).toBeNull();
    });

    it('returns the latest OPEN cycle as CycleInfo', async () => {
      const openCycle = makeCycleRow({ id: 'c-open', sequence: 7, state: CycleState.OPEN });
      vi.mocked(prisma.surveyCycle.findFirst).mockResolvedValue(openCycle as never);

      const result = await service.getActiveCycle('survey-1');

      expect(result).not.toBeNull();
      expect((result as CycleInfo).id).toBe('c-open');
      expect((result as CycleInfo).state).toBe(CycleState.OPEN);
      expect((result as CycleInfo).sequence).toBe(7);
    });

    it('queries with state = OPEN and orders by sequence desc', async () => {
      vi.mocked(prisma.surveyCycle.findFirst).mockResolvedValue(null);

      await service.getActiveCycle('survey-42');

      expect(prisma.surveyCycle.findFirst).toHaveBeenCalledWith({
        where: { surveyId: 'survey-42', state: CycleState.OPEN },
        orderBy: { sequence: 'desc' },
      });
    });
  });
});
