import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

import { QuestionType, Category, XSource } from '@mhm/shared';
import type { Principal } from '@mhm/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ANTIFRAUD_SERVICE,
  CYCLE_SERVICE,
  GAMIFICATION_SERVICE,
  type IAntifraudService,
  type ICycleService,
  type IGamificationService,
} from '../../common/facades';

import { ResponseService } from './response.service';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const FAKE_QUESTION_YES_NO = {
  id: 'q-yes-no-1',
  surveyId: 'survey-1',
  category: Category.GENERAL,
  type: QuestionType.YES_NO,
  active: true,
  textHe: 'שאלה',
  textEn: 'Question',
  scaleMin: null,
  scaleMax: null,
  options: null,
  imageUrl: null,
  expiresAfterCycles: null,
  startCycleSequence: 1,
  targeting: null,
  createdAt: new Date(),
};

const FAKE_QUESTION_SCALE = {
  ...FAKE_QUESTION_YES_NO,
  id: 'q-scale-1',
  type: QuestionType.SCALE,
  scaleMin: 1,
  scaleMax: 5,
};

const FAKE_QUESTION_SINGLE_CHOICE = {
  ...FAKE_QUESTION_YES_NO,
  id: 'q-choice-1',
  type: QuestionType.SINGLE_CHOICE,
  options: [{ key: 'A', labelHe: 'א', labelEn: 'A' }],
};

const FAKE_QUESTION_INACTIVE = {
  ...FAKE_QUESTION_YES_NO,
  id: 'q-inactive',
  active: false,
};

const FAKE_CYCLE = { id: 'cycle-1', surveyId: 'survey-1' };

const FAKE_GAM_RESULT = {
  pointsEarned: 10,
  newBadges: [],
  challengeProgress: null,
};

const PRINCIPAL: Principal = {
  type: 'respondent',
  respondentId: 'respondent-1',
  trustScore: 0.8,
  xSource: XSource.APP,
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    question: {
      findUnique: vi.fn(),
    },
    response: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

function buildGamificationMock(): IGamificationService {
  return {
    onResponseRecorded: vi.fn().mockResolvedValue(FAKE_GAM_RESULT),
    generateChallengeForCycle: vi.fn(),
    getProfileGamification: vi.fn(),
  };
}

function buildCycleMock(): ICycleService {
  return {
    getActiveCycle: vi.fn().mockResolvedValue(FAKE_CYCLE),
  };
}

function buildAntifraudMock(): IAntifraudService {
  return {
    assess: vi.fn().mockResolvedValue({ flagged: false }),
  };
}

async function buildModule(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  gamMock: IGamificationService,
  cycleMock: ICycleService,
  antifraudMock: IAntifraudService,
): Promise<ResponseService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ResponseService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: GAMIFICATION_SERVICE, useValue: gamMock },
      { provide: CYCLE_SERVICE, useValue: cycleMock },
      { provide: ANTIFRAUD_SERVICE, useValue: antifraudMock },
    ],
  }).compile();

  return module.get(ResponseService);
}

// ---------------------------------------------------------------------------
// ResponseService.submit
// ---------------------------------------------------------------------------

describe('ResponseService.submit', () => {
  let service: ResponseService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let gamification: IGamificationService;
  let cycle: ICycleService;
  let antifraud: IAntifraudService;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    gamification = buildGamificationMock();
    cycle = buildCycleMock();
    antifraud = buildAntifraudMock();
    service = await buildModule(prisma, gamification, cycle, antifraud);
  });

  it('throws NotFoundException when question does not exist', async () => {
    prisma.question.findUnique.mockResolvedValue(null);

    await expect(
      service.submit({ questionId: 'q-missing', answerValue: '1' }, PRINCIPAL),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when question exists but is inactive', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_INACTIVE);

    await expect(
      service.submit({ questionId: FAKE_QUESTION_INACTIVE.id, answerValue: '1' }, PRINCIPAL),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException (409) when Prisma P2002 is raised (never-repeat)', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    prisma.response.create.mockRejectedValue(p2002);

    await expect(
      service.submit({ questionId: FAKE_QUESTION_YES_NO.id, answerValue: '1' }, PRINCIPAL),
    ).rejects.toThrow(ConflictException);
  });

  it('stores trustScoreAtSubmission equal to principal.trustScore', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});

    await service.submit({ questionId: FAKE_QUESTION_YES_NO.id, answerValue: '1' }, PRINCIPAL);

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.trustScoreAtSubmission).toBe(PRINCIPAL.trustScore);
  });

  it('stores source equal to principal.xSource', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});

    await service.submit({ questionId: FAKE_QUESTION_YES_NO.id, answerValue: '1' }, PRINCIPAL);

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.source).toBe(XSource.APP);
  });

  it('sets rawCounted:false and flagged:true when antifraud flags the submission', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});
    (antifraud.assess as ReturnType<typeof vi.fn>).mockResolvedValue({
      flagged: true,
      reason: 'too_fast',
    });

    await service.submit(
      { questionId: FAKE_QUESTION_YES_NO.id, answerValue: '1', answerTimeMs: 100 },
      PRINCIPAL,
    );

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.rawCounted).toBe(false);
    expect(createArg.flagged).toBe(true);
    expect(createArg.flagReason).toBe('too_fast');
  });

  it('sets rawCounted:true and flagged:false when antifraud is clean', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});

    await service.submit(
      { questionId: FAKE_QUESTION_YES_NO.id, answerValue: '1', answerTimeMs: 2000 },
      PRINCIPAL,
    );

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.rawCounted).toBe(true);
    expect(createArg.flagged).toBe(false);
  });

  it('normalises yes_no "yes" → "1"', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});

    await service.submit({ questionId: FAKE_QUESTION_YES_NO.id, answerValue: 'yes' }, PRINCIPAL);

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.answerValue).toBe('1');
  });

  it('normalises yes_no "false" → "0"', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});

    await service.submit({ questionId: FAKE_QUESTION_YES_NO.id, answerValue: 'false' }, PRINCIPAL);

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.answerValue).toBe('0');
  });

  it('normalises scale numeric value to a string', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_SCALE);
    prisma.response.create.mockResolvedValue({});

    await service.submit({ questionId: FAKE_QUESTION_SCALE.id, answerValue: 3 }, PRINCIPAL);

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.answerValue).toBe('3');
  });

  it('passes through single_choice option key unchanged', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_SINGLE_CHOICE);
    prisma.response.create.mockResolvedValue({});

    await service.submit(
      { questionId: FAKE_QUESTION_SINGLE_CHOICE.id, answerValue: 'A' },
      PRINCIPAL,
    );

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.answerValue).toBe('A');
  });

  it('calls gamification.onResponseRecorded with skipped:false and seen:true', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});

    await service.submit({ questionId: FAKE_QUESTION_YES_NO.id, answerValue: '1' }, PRINCIPAL);

    expect(gamification.onResponseRecorded).toHaveBeenCalledWith(
      expect.objectContaining({
        respondentId: PRINCIPAL.respondentId,
        questionId: FAKE_QUESTION_YES_NO.id,
        skipped: false,
        seen: true,
        cycleId: FAKE_CYCLE.id,
      }),
    );
  });

  it('returns the gamification result inside the response envelope', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});
    const customGam = { pointsEarned: 25, newBadges: ['FAST'], challengeProgress: null };
    (gamification.onResponseRecorded as ReturnType<typeof vi.fn>).mockResolvedValue(customGam);

    const result = await service.submit(
      { questionId: FAKE_QUESTION_YES_NO.id, answerValue: '1' },
      PRINCIPAL,
    );

    expect(result.accepted).toBe(true);
    expect(result.pointsEarned).toBe(25);
    expect(result.newBadges).toEqual(['FAST']);
    expect(result.challengeProgress).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ResponseService.skip — "seen" rule
// ---------------------------------------------------------------------------

describe('ResponseService.skip — seen flag', () => {
  let service: ResponseService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let gamification: IGamificationService;
  let cycle: ICycleService;
  let antifraud: IAntifraudService;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    gamification = buildGamificationMock();
    cycle = buildCycleMock();
    antifraud = buildAntifraudMock();
    service = await buildModule(prisma, gamification, cycle, antifraud);
  });

  it('sets seen:false when skipping a SCALE question', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_SCALE);
    prisma.response.create.mockResolvedValue({});

    await service.skip({ questionId: FAKE_QUESTION_SCALE.id }, PRINCIPAL);

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.seen).toBe(false);
  });

  it('sets seen:true when skipping a YES_NO question', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});

    await service.skip({ questionId: FAKE_QUESTION_YES_NO.id }, PRINCIPAL);

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.seen).toBe(true);
  });

  it('sets seen:true when skipping a SINGLE_CHOICE question', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_SINGLE_CHOICE);
    prisma.response.create.mockResolvedValue({});

    await service.skip({ questionId: FAKE_QUESTION_SINGLE_CHOICE.id }, PRINCIPAL);

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.seen).toBe(true);
  });

  it('always sets skipped:true and answerValue:null on skip', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});

    await service.skip({ questionId: FAKE_QUESTION_YES_NO.id }, PRINCIPAL);

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.skipped).toBe(true);
    expect(createArg.answerValue).toBeNull();
  });

  it('always sets rawCounted:false on skip', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});

    await service.skip({ questionId: FAKE_QUESTION_YES_NO.id }, PRINCIPAL);

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.rawCounted).toBe(false);
  });

  it('stamps trustScoreAtSubmission from principal on skip', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});

    await service.skip({ questionId: FAKE_QUESTION_YES_NO.id }, PRINCIPAL);

    const createArg = prisma.response.create.mock.calls[0][0].data;
    expect(createArg.trustScoreAtSubmission).toBe(PRINCIPAL.trustScore);
  });

  it('throws ConflictException (409) on P2002 during skip (never-repeat)', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    prisma.response.create.mockRejectedValue(p2002);

    await expect(
      service.skip({ questionId: FAKE_QUESTION_YES_NO.id }, PRINCIPAL),
    ).rejects.toThrow(ConflictException);
  });

  it('calls gamification.onResponseRecorded with skipped:true', async () => {
    prisma.question.findUnique.mockResolvedValue(FAKE_QUESTION_YES_NO);
    prisma.response.create.mockResolvedValue({});

    await service.skip({ questionId: FAKE_QUESTION_YES_NO.id }, PRINCIPAL);

    expect(gamification.onResponseRecorded).toHaveBeenCalledWith(
      expect.objectContaining({ skipped: true }),
    );
  });
});

// ---------------------------------------------------------------------------
// ResponseService.getAnswered
// ---------------------------------------------------------------------------

describe('ResponseService.getAnswered', () => {
  let service: ResponseService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    service = await buildModule(prisma, buildGamificationMock(), buildCycleMock(), buildAntifraudMock());
  });

  it('returns an empty array when the respondent has no responses', async () => {
    prisma.response.findMany.mockResolvedValue([]);

    const result = await service.getAnswered('respondent-1');
    expect(result).toEqual([]);
  });

  it('maps rows to answeredAt ISO strings', async () => {
    const date = new Date('2025-01-15T10:00:00.000Z');
    prisma.response.findMany.mockResolvedValue([
      { questionId: 'q1', skipped: false, answeredAt: date },
    ]);

    const result = await service.getAnswered('respondent-1');
    expect(result).toHaveLength(1);
    expect(result[0].questionId).toBe('q1');
    expect(result[0].skipped).toBe(false);
    expect(result[0].answeredAt).toBe(date.toISOString());
  });

  it('queries by the supplied respondentId', async () => {
    prisma.response.findMany.mockResolvedValue([]);

    await service.getAnswered('respondent-42');

    expect(prisma.response.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { respondentId: 'respondent-42' } }),
    );
  });
});
