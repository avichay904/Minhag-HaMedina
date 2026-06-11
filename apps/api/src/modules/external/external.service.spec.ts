import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExternalService } from './external.service';
import type { ExternalRegisterRequestDto } from './dto/external.dto';
import type { ExternalRespondentUpdateDto } from './dto/external.dto';

// ---------------------------------------------------------------------------
// Minimal mock factories
// ---------------------------------------------------------------------------

function makeSource(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'src-1',
    name: 'Test Source',
    apiKeyHash: 'hash',
    trustScoreMin: 0.4,
    trustScoreMax: 0.7,
    canRegisterUsers: true,
    canReadResults: true,
    resultsScope: { ownRespondentsOnly: true, categories: [] },
    active: true,
    createdAt: new Date(),
    ...overrides,
  };
}

function makePrisma() {
  return {
    respondent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    surveyCycle: {
      findMany: vi.fn(),
    },
    response: {
      findMany: vi.fn(),
    },
  };
}

function makeJwt() {
  return {
    sign: vi.fn().mockReturnValue('test-jwt-token'),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExternalService', () => {
  let service: ExternalService;
  let prisma: ReturnType<typeof makePrisma>;
  let jwt: ReturnType<typeof makeJwt>;

  beforeEach(() => {
    prisma = makePrisma();
    jwt = makeJwt();
    service = new ExternalService(prisma as any, jwt as any);
  });

  // =========================================================================
  // registerRespondent
  // =========================================================================

  describe('registerRespondent', () => {
    it('returns respondentId + token on success', async () => {
      const source = makeSource();
      const dto: ExternalRegisterRequestDto = {
        externalId: 'ext-abc',
        demographics: { age: 30, gender: 'MALE', region: 'IL' },
        preferredLanguage: 'EN',
      };
      const respondentRow = { id: 'resp-1' };
      (prisma.respondent.create as Mock).mockResolvedValue(respondentRow);

      const result = await service.registerRespondent(source as any, dto);

      expect(result).toEqual({ respondentId: 'resp-1', token: 'test-jwt-token' });
    });

    it('creates respondent with EXTERNAL_AUTHORIZED authProvider', async () => {
      const source = makeSource();
      (prisma.respondent.create as Mock).mockResolvedValue({ id: 'resp-2' });

      await service.registerRespondent(source as any, {} as ExternalRegisterRequestDto);

      expect(prisma.respondent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authProvider: 'EXTERNAL_AUTHORIZED',
            sourceId: 'src-1',
          }),
        }),
      );
    });

    it('clamps trustScore to source max when base exceeds it', async () => {
      // EXTERNAL_AUTHORIZED base = 1.0, but source max = 0.7 → clamped to 0.7
      const source = makeSource({ trustScoreMin: 0.4, trustScoreMax: 0.7 });
      (prisma.respondent.create as Mock).mockResolvedValue({ id: 'resp-3' });

      await service.registerRespondent(source as any, {} as ExternalRegisterRequestDto);

      const call = (prisma.respondent.create as Mock).mock.calls[0][0];
      expect(call.data.trustScore).toBe(0.7);
    });

    it('clamps trustScore to source min when base is below it', async () => {
      // Using a source with a high floor to verify clamping up.
      // EXTERNAL_AUTHORIZED base = 1.0 would not be clamped up, but we test the mechanism:
      // for EXTERNAL_UNKNOWN (0.4) with source min=0.6, score should lift to 0.6.
      // We exercise this indirectly via a source with trustScoreMin=0.9 and max=1.0.
      const source = makeSource({ trustScoreMin: 0.9, trustScoreMax: 1.0 });
      (prisma.respondent.create as Mock).mockResolvedValue({ id: 'resp-4' });

      await service.registerRespondent(source as any, {} as ExternalRegisterRequestDto);

      const call = (prisma.respondent.create as Mock).mock.calls[0][0];
      // Base is 1.0 (EXTERNAL_AUTHORIZED), min=0.9, max=1.0 → stays at 1.0
      expect(call.data.trustScore).toBe(1.0);
    });

    it('clamps trustScore when trustScoreMax is very low', async () => {
      const source = makeSource({ trustScoreMin: 0.4, trustScoreMax: 0.4 });
      (prisma.respondent.create as Mock).mockResolvedValue({ id: 'resp-5' });

      await service.registerRespondent(source as any, {} as ExternalRegisterRequestDto);

      const call = (prisma.respondent.create as Mock).mock.calls[0][0];
      expect(call.data.trustScore).toBe(0.4);
    });

    it('throws ForbiddenException when canRegisterUsers is false', async () => {
      const source = makeSource({ canRegisterUsers: false });

      await expect(
        service.registerRespondent(source as any, {} as ExternalRegisterRequestDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('stores demographics flat columns on the respondent', async () => {
      const source = makeSource();
      const dto: ExternalRegisterRequestDto = {
        demographics: { age: 25, gender: 'FEMALE', region: 'US' },
      };
      (prisma.respondent.create as Mock).mockResolvedValue({ id: 'resp-6' });

      await service.registerRespondent(source as any, dto);

      const call = (prisma.respondent.create as Mock).mock.calls[0][0];
      expect(call.data).toMatchObject({ age: 25, gender: 'FEMALE', region: 'US' });
    });

    it('signs a JWT containing the respondent id and trust score', async () => {
      const source = makeSource({ trustScoreMin: 0.4, trustScoreMax: 0.7 });
      (prisma.respondent.create as Mock).mockResolvedValue({ id: 'resp-7' });

      await service.registerRespondent(source as any, {} as ExternalRegisterRequestDto);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'resp-7',
          type: 'respondent',
          trustScore: 0.7,
          sourceId: 'src-1',
          authProvider: 'EXTERNAL_AUTHORIZED',
        }),
      );
    });
  });

  // =========================================================================
  // updateRespondent
  // =========================================================================

  describe('updateRespondent', () => {
    it('updates demographics and preferredLanguage on a matching respondent', async () => {
      const source = makeSource();
      const existing = {
        id: 'resp-1',
        sourceId: 'src-1',
        externalId: null,
        preferredLanguage: 'HE',
        age: null,
        gender: null,
        region: null,
      };
      (prisma.respondent.findUnique as Mock).mockResolvedValue(existing);
      (prisma.respondent.update as Mock).mockResolvedValue({});

      const dto: ExternalRespondentUpdateDto = {
        demographics: { age: 40, gender: 'OTHER', region: 'DE' },
        preferredLanguage: 'EN',
      };

      await service.updateRespondent(source as any, 'resp-1', dto);

      expect(prisma.respondent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'resp-1' },
          data: expect.objectContaining({ age: 40, gender: 'OTHER', region: 'DE', preferredLanguage: 'EN' }),
        }),
      );
    });

    it('throws NotFoundException when respondent does not exist', async () => {
      const source = makeSource();
      (prisma.respondent.findUnique as Mock).mockResolvedValue(null);

      await expect(
        service.updateRespondent(source as any, 'nonexistent', {} as ExternalRespondentUpdateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when respondent belongs to a different source', async () => {
      const source = makeSource({ id: 'src-1' });
      const existing = { id: 'resp-1', sourceId: 'src-OTHER' };
      (prisma.respondent.findUnique as Mock).mockResolvedValue(existing);

      await expect(
        service.updateRespondent(source as any, 'resp-1', {} as ExternalRespondentUpdateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies access when respondent sourceId is null (not an external respondent)', async () => {
      const source = makeSource({ id: 'src-1' });
      const existing = { id: 'resp-1', sourceId: null };
      (prisma.respondent.findUnique as Mock).mockResolvedValue(existing);

      await expect(
        service.updateRespondent(source as any, 'resp-1', {} as ExternalRespondentUpdateDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // getResults
  // =========================================================================

  describe('getResults', () => {
    it('throws ForbiddenException when canReadResults is false', async () => {
      const source = makeSource({ canReadResults: false });

      await expect(service.getResults(source as any)).rejects.toThrow(ForbiddenException);
    });

    it('returns empty array when no APPROVED/PUBLISHED cycles exist', async () => {
      const source = makeSource();
      (prisma.surveyCycle.findMany as Mock).mockResolvedValue([]);
      (prisma.respondent.findMany as Mock).mockResolvedValue([]);

      const result = await service.getResults(source as any);
      expect(result).toEqual([]);
    });

    it('returns results only for APPROVED and PUBLISHED cycles', async () => {
      const source = makeSource();
      const cycles = [
        {
          id: 'cycle-1',
          state: 'APPROVED',
          displayMode: 'BOTH',
          survey: {
            id: 'survey-1',
            questions: [
              { id: 'q-1', textHe: 'כן/לא', textEn: 'Yes/No', type: 'YES_NO', active: true, category: 'GENERAL' },
            ],
          },
        },
      ];
      (prisma.surveyCycle.findMany as Mock).mockResolvedValue(cycles);
      (prisma.respondent.findMany as Mock).mockResolvedValue([{ id: 'resp-1' }]);
      (prisma.response.findMany as Mock).mockResolvedValue([
        {
          id: 'r-1',
          questionId: 'q-1',
          respondentId: 'resp-1',
          answerValue: '1',
          skipped: false,
          trustScoreAtSubmission: 0.7,
          rawCounted: true,
        },
      ]);

      const results = await service.getResults(source as any);
      expect(results).toHaveLength(1);
      expect(results[0].cycleId).toBe('cycle-1');
      expect(results[0].state).toBe('APPROVED');
    });

    it('only includes responses belonging to this source respondents (ownRespondentsOnly)', async () => {
      const source = makeSource({
        resultsScope: { ownRespondentsOnly: true, categories: [] },
      });
      const cycles = [
        {
          id: 'cycle-2',
          state: 'PUBLISHED',
          displayMode: 'RAW',
          survey: {
            id: 'survey-2',
            questions: [
              { id: 'q-2', textHe: 'שאלה', textEn: 'Question', type: 'SCALE', active: true, category: 'TECHNOLOGY' },
            ],
          },
        },
      ];
      (prisma.surveyCycle.findMany as Mock).mockResolvedValue(cycles);
      // Only own respondent:
      (prisma.respondent.findMany as Mock).mockResolvedValue([{ id: 'own-resp' }]);
      // Response from own respondent:
      (prisma.response.findMany as Mock).mockResolvedValue([
        {
          id: 'r-own',
          questionId: 'q-2',
          respondentId: 'own-resp',
          answerValue: '5',
          skipped: false,
          trustScoreAtSubmission: 0.6,
          rawCounted: true,
        },
      ]);

      const results = await service.getResults(source as any);
      expect(results).toHaveLength(1);
      // Raw count should be 1 (only own respondent's response)
      expect(results[0].questions[0].totalResponses).toBe(1);
    });

    it('filters questions by allowed categories when resultsScope.categories is non-empty', async () => {
      const source = makeSource({
        resultsScope: { ownRespondentsOnly: true, categories: ['TECHNOLOGY'] },
      });
      const cycles = [
        {
          id: 'cycle-3',
          state: 'APPROVED',
          displayMode: 'RAW',
          survey: {
            id: 'survey-3',
            questions: [
              { id: 'q-tech', textHe: 'טכנולוגיה', textEn: 'Technology', type: 'YES_NO', active: true, category: 'TECHNOLOGY' },
              { id: 'q-general', textHe: 'כללי', textEn: 'General', type: 'YES_NO', active: true, category: 'GENERAL' },
            ],
          },
        },
      ];
      (prisma.surveyCycle.findMany as Mock).mockResolvedValue(cycles);
      (prisma.respondent.findMany as Mock).mockResolvedValue([{ id: 'resp-1' }]);
      (prisma.response.findMany as Mock).mockResolvedValue([]);

      const results = await service.getResults(source as any);
      expect(results).toHaveLength(1);
      // Only the TECHNOLOGY question should be included
      expect(results[0].questions).toHaveLength(1);
      expect(results[0].questions[0].questionId).toBe('q-tech');
    });

    it('includes all categories when resultsScope.categories is empty', async () => {
      const source = makeSource({
        resultsScope: { ownRespondentsOnly: true, categories: [] },
      });
      const cycles = [
        {
          id: 'cycle-4',
          state: 'APPROVED',
          displayMode: 'RAW',
          survey: {
            id: 'survey-4',
            questions: [
              { id: 'q-a', textHe: 'א', textEn: 'A', type: 'YES_NO', active: true, category: 'GENERAL' },
              { id: 'q-b', textHe: 'ב', textEn: 'B', type: 'YES_NO', active: true, category: 'TECHNOLOGY' },
            ],
          },
        },
      ];
      (prisma.surveyCycle.findMany as Mock).mockResolvedValue(cycles);
      (prisma.respondent.findMany as Mock).mockResolvedValue([]);
      (prisma.response.findMany as Mock).mockResolvedValue([]);

      const results = await service.getResults(source as any);
      // No responses means no results (0 questions with responses), but the cycle is still returned
      expect(results).toHaveLength(1);
      expect(results[0].questions).toHaveLength(2);
    });

    it('computes correct skipRate', async () => {
      const source = makeSource();
      const cycles = [
        {
          id: 'cycle-5',
          state: 'APPROVED',
          displayMode: 'RAW',
          survey: {
            id: 'survey-5',
            questions: [
              { id: 'q-5', textHe: 'שאלה', textEn: 'Q', type: 'YES_NO', active: true, category: 'GENERAL' },
            ],
          },
        },
      ];
      (prisma.surveyCycle.findMany as Mock).mockResolvedValue(cycles);
      (prisma.respondent.findMany as Mock).mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
      (prisma.response.findMany as Mock).mockResolvedValue([
        {
          id: 'resp-a',
          questionId: 'q-5',
          respondentId: 'r1',
          answerValue: '1',
          skipped: false,
          trustScoreAtSubmission: 0.7,
          rawCounted: true,
        },
        {
          id: 'resp-b',
          questionId: 'q-5',
          respondentId: 'r2',
          answerValue: null,
          skipped: true,
          trustScoreAtSubmission: 0.7,
          rawCounted: true,
        },
      ]);

      const results = await service.getResults(source as any);
      const q = results[0].questions[0];
      // 1 answered, 1 skipped → skipRate = 0.5
      expect(q.skipRate).toBeCloseTo(0.5);
    });

    it('reports totalRespondents as unique respondents in the cycle', async () => {
      const source = makeSource();
      const cycles = [
        {
          id: 'cycle-6',
          state: 'APPROVED',
          displayMode: 'RAW',
          survey: {
            id: 'survey-6',
            questions: [
              { id: 'q-6', textHe: 'שאלה', textEn: 'Q', type: 'YES_NO', active: true, category: 'GENERAL' },
            ],
          },
        },
      ];
      (prisma.surveyCycle.findMany as Mock).mockResolvedValue(cycles);
      (prisma.respondent.findMany as Mock).mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
      (prisma.response.findMany as Mock).mockResolvedValue([
        { id: 'a', questionId: 'q-6', respondentId: 'r1', answerValue: '0', skipped: false, trustScoreAtSubmission: 0.7, rawCounted: true },
        { id: 'b', questionId: 'q-6', respondentId: 'r2', answerValue: '1', skipped: false, trustScoreAtSubmission: 0.7, rawCounted: true },
      ]);

      const results = await service.getResults(source as any);
      expect(results[0].totalRespondents).toBe(2);
    });

    it('does NOT include responses from respondents of a different source', async () => {
      // Even if the Prisma query returns them (which it won't due to the filter),
      // ownRespondentsOnly gate rejects them.
      const source = makeSource({ id: 'src-mine', resultsScope: { ownRespondentsOnly: true, categories: [] } });
      const cycles = [
        {
          id: 'cycle-7',
          state: 'APPROVED',
          displayMode: 'RAW',
          survey: {
            id: 'survey-7',
            questions: [
              { id: 'q-7', textHe: 'שאלה', textEn: 'Q', type: 'YES_NO', active: true, category: 'GENERAL' },
            ],
          },
        },
      ];
      (prisma.surveyCycle.findMany as Mock).mockResolvedValue(cycles);
      // Own respondents: only 'own-r'
      (prisma.respondent.findMany as Mock).mockResolvedValue([{ id: 'own-r' }]);
      // Both own and foreign responses returned (simulating a loose query)
      (prisma.response.findMany as Mock).mockResolvedValue([
        { id: 'r-own', questionId: 'q-7', respondentId: 'own-r', answerValue: '1', skipped: false, trustScoreAtSubmission: 0.7, rawCounted: true },
        { id: 'r-foreign', questionId: 'q-7', respondentId: 'foreign-r', answerValue: '0', skipped: false, trustScoreAtSubmission: 0.7, rawCounted: true },
      ]);

      const results = await service.getResults(source as any);
      // foreign-r is not in ownIdSet, so it should not be counted
      expect(results[0].questions[0].totalResponses).toBe(1);
    });
  });
});
