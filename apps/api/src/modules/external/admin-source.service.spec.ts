import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AdminSourceService } from './admin-source.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeSourceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'src-1',
    name: 'Test Source',
    apiKeyHash: 'some-hash',
    trustScoreMin: 0.4,
    trustScoreMax: 1.0,
    canRegisterUsers: false,
    canReadResults: false,
    resultsScope: null,
    active: true,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makePrisma() {
  return {
    externalSource: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminSourceService', () => {
  let service: AdminSourceService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AdminSourceService(prisma as any);
  });

  // =========================================================================
  // listSources
  // =========================================================================

  describe('listSources', () => {
    it('returns all sources without apiKeyHash', async () => {
      const row = makeSourceRow();
      vi.mocked(prisma.externalSource.findMany).mockResolvedValue([row] as never);

      const result = await service.listSources();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('src-1');
      expect((result[0] as any).apiKeyHash).toBeUndefined();
    });

    it('maps createdAt to ISO string', async () => {
      const createdAt = new Date('2024-06-01T12:00:00Z');
      vi.mocked(prisma.externalSource.findMany).mockResolvedValue([makeSourceRow({ createdAt })] as never);

      const result = await service.listSources();

      expect(result[0].createdAt).toBe(createdAt.toISOString());
    });

    it('returns empty array when no sources exist', async () => {
      vi.mocked(prisma.externalSource.findMany).mockResolvedValue([] as never);

      const result = await service.listSources();

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // createSource
  // =========================================================================

  describe('createSource', () => {
    it('creates a source with generated apiKey and stores its hash', async () => {
      const created = makeSourceRow();
      vi.mocked(prisma.externalSource.create).mockResolvedValue(created as never);

      const result = await service.createSource({ name: 'My Source' });

      // raw apiKey must be present (returned once)
      expect(result.apiKey).toBeDefined();
      expect(typeof result.apiKey).toBe('string');
      expect(result.apiKey.length).toBeGreaterThan(0);

      // apiKeyHash should have been stored (not returned in result)
      const callArg = vi.mocked(prisma.externalSource.create).mock.calls[0][0];
      expect(callArg.data.apiKeyHash).toBeDefined();
      expect(callArg.data.apiKeyHash).not.toBe(result.apiKey);
    });

    it('applies defaults for optional fields', async () => {
      const created = makeSourceRow();
      vi.mocked(prisma.externalSource.create).mockResolvedValue(created as never);

      await service.createSource({ name: 'Src' });

      const callArg = vi.mocked(prisma.externalSource.create).mock.calls[0][0];
      expect(callArg.data.trustScoreMin).toBe(0.4);
      expect(callArg.data.trustScoreMax).toBe(1.0);
      expect(callArg.data.canRegisterUsers).toBe(false);
      expect(callArg.data.canReadResults).toBe(false);
      expect(callArg.data.active).toBe(true);
    });

    it('uses provided values over defaults', async () => {
      const created = makeSourceRow({ trustScoreMin: 0.6, trustScoreMax: 0.8, canRegisterUsers: true });
      vi.mocked(prisma.externalSource.create).mockResolvedValue(created as never);

      await service.createSource({
        name: 'Src',
        trustScoreMin: 0.6,
        trustScoreMax: 0.8,
        canRegisterUsers: true,
      });

      const callArg = vi.mocked(prisma.externalSource.create).mock.calls[0][0];
      expect(callArg.data.trustScoreMin).toBe(0.6);
      expect(callArg.data.trustScoreMax).toBe(0.8);
      expect(callArg.data.canRegisterUsers).toBe(true);
    });

    it('returns the source dto fields without apiKeyHash', async () => {
      const created = makeSourceRow({ name: 'New Src' });
      vi.mocked(prisma.externalSource.create).mockResolvedValue(created as never);

      const result = await service.createSource({ name: 'New Src' });

      expect(result.id).toBe('src-1');
      expect(result.name).toBe('New Src');
      expect((result as any).apiKeyHash).toBeUndefined();
      expect(result.apiKey).toBeDefined(); // raw key present
    });
  });

  // =========================================================================
  // updateSource
  // =========================================================================

  describe('updateSource', () => {
    it('throws NotFoundException when source does not exist', async () => {
      vi.mocked(prisma.externalSource.findUnique).mockResolvedValue(null);

      await expect(service.updateSource('nonexistent', {})).rejects.toThrow(NotFoundException);
    });

    it('updates active flag', async () => {
      const existing = makeSourceRow();
      vi.mocked(prisma.externalSource.findUnique).mockResolvedValue(existing as never);
      const updated = makeSourceRow({ active: false });
      vi.mocked(prisma.externalSource.update).mockResolvedValue(updated as never);

      const result = await service.updateSource('src-1', { active: false });

      expect(prisma.externalSource.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'src-1' },
          data: expect.objectContaining({ active: false }),
        }),
      );
      expect(result.active).toBe(false);
    });

    it('updates canRegisterUsers and canReadResults', async () => {
      const existing = makeSourceRow();
      vi.mocked(prisma.externalSource.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.externalSource.update).mockResolvedValue(
        makeSourceRow({ canRegisterUsers: true, canReadResults: true }) as never,
      );

      await service.updateSource('src-1', { canRegisterUsers: true, canReadResults: true });

      const callArg = vi.mocked(prisma.externalSource.update).mock.calls[0][0];
      expect(callArg.data.canRegisterUsers).toBe(true);
      expect(callArg.data.canReadResults).toBe(true);
    });

    it('does not include unchanged fields in the update payload', async () => {
      const existing = makeSourceRow();
      vi.mocked(prisma.externalSource.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.externalSource.update).mockResolvedValue(makeSourceRow() as never);

      await service.updateSource('src-1', { active: true });

      const callArg = vi.mocked(prisma.externalSource.update).mock.calls[0][0];
      // Only `active` should be in the data — no trustScoreMin, name, etc.
      expect(Object.keys(callArg.data)).toEqual(['active']);
    });

    it('returns the updated source without apiKeyHash', async () => {
      const existing = makeSourceRow();
      vi.mocked(prisma.externalSource.findUnique).mockResolvedValue(existing as never);
      vi.mocked(prisma.externalSource.update).mockResolvedValue(existing as never);

      const result = await service.updateSource('src-1', {});

      expect((result as any).apiKeyHash).toBeUndefined();
      expect((result as any).apiKey).toBeUndefined();
    });
  });
});
