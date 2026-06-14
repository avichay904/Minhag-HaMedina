import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Cadence, CycleState, DisplayMode } from '@mhm/shared';
import { SurveyService } from './survey.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CYCLE_SERVICE, QUESTION_SERVICE } from '../../common/facades';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeSurveyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'survey-1',
    titleHe: 'סקר בדיקה',
    titleEn: 'Test Survey',
    cadence: Cadence.WEEKLY,
    active: true,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeCycleRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cycle-1',
    surveyId: 'survey-1',
    sequence: 1,
    state: CycleState.OPEN,
    displayMode: DisplayMode.BOTH,
    openedAt: new Date('2024-01-01'),
    closedAt: null,
    publishedAt: null,
    ...overrides,
  };
}

function makePrisma() {
  return {
    survey: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    surveyCycle: {
      findMany: vi.fn(),
    },
  };
}

function makeCycleService() {
  return {
    getActiveCycle: vi.fn().mockResolvedValue(null),
  };
}

function makeQuestionService() {
  return {
    countActiveQuestions: vi.fn().mockResolvedValue(0),
    getServableQuestions: vi.fn().mockResolvedValue([]),
  };
}

async function buildModule(prisma: ReturnType<typeof makePrisma>): Promise<SurveyService> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      SurveyService,
      { provide: PrismaService, useValue: prisma },
      { provide: CYCLE_SERVICE, useValue: makeCycleService() },
      { provide: QUESTION_SERVICE, useValue: makeQuestionService() },
    ],
  }).compile();

  return moduleRef.get(SurveyService);
}

// ---------------------------------------------------------------------------
// createSurvey
// ---------------------------------------------------------------------------

describe('SurveyService.createSurvey', () => {
  let service: SurveyService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    service = await buildModule(prisma);
  });

  it('creates a survey with the provided titles and cadence', async () => {
    const created = makeSurveyRow({ cadence: Cadence.MONTHLY });
    vi.mocked(prisma.survey.create).mockResolvedValue(created as never);

    const result = await service.createSurvey({
      titleHe: 'סקר בדיקה',
      titleEn: 'Test Survey',
      cadence: 'MONTHLY',
    });

    expect(prisma.survey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          titleHe: 'סקר בדיקה',
          titleEn: 'Test Survey',
          cadence: 'MONTHLY',
          active: true,
        }),
      }),
    );
    expect(result.id).toBe('survey-1');
    expect(result.cadence).toBe(Cadence.MONTHLY);
    expect(result.activeCycle).toBeNull();
    expect(result.questionCount).toBe(0);
  });

  it('defaults cadence to WEEKLY when not provided', async () => {
    const created = makeSurveyRow();
    vi.mocked(prisma.survey.create).mockResolvedValue(created as never);

    await service.createSurvey({ titleHe: 'א', titleEn: 'B' });

    const callArg = vi.mocked(prisma.survey.create).mock.calls[0][0];
    expect(callArg.data.cadence).toBe('WEEKLY');
  });

  it('returns a SurveyDto with questionCount=0 and activeCycle=null', async () => {
    const created = makeSurveyRow();
    vi.mocked(prisma.survey.create).mockResolvedValue(created as never);

    const result = await service.createSurvey({ titleHe: 'א', titleEn: 'B' });

    expect(result.questionCount).toBe(0);
    expect(result.activeCycle).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listAllSurveys
// ---------------------------------------------------------------------------

describe('SurveyService.listAllSurveys', () => {
  let service: SurveyService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    service = await buildModule(prisma);
  });

  it('returns all surveys with their cycles and question counts', async () => {
    const cycle = makeCycleRow({ id: 'c-1' });
    const survey = {
      ...makeSurveyRow(),
      cycles: [cycle],
      _count: { questions: 3 },
    };
    vi.mocked(prisma.survey.findMany).mockResolvedValue([survey] as never);

    const result = await service.listAllSurveys();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('survey-1');
    expect(result[0].questionCount).toBe(3);
    expect(result[0].cycles).toHaveLength(1);
    expect(result[0].cycles[0].id).toBe('c-1');
  });

  it('includes inactive surveys', async () => {
    const inactiveSurvey = {
      ...makeSurveyRow({ active: false }),
      cycles: [],
      _count: { questions: 0 },
    };
    vi.mocked(prisma.survey.findMany).mockResolvedValue([inactiveSurvey] as never);

    const result = await service.listAllSurveys();

    expect(result).toHaveLength(1);
    expect(result[0].active).toBe(false);
  });

  it('maps cycle fields correctly', async () => {
    const openedAt = new Date('2024-06-01T00:00:00Z');
    const closedAt = new Date('2024-06-07T00:00:00Z');
    const cycle = makeCycleRow({
      id: 'c-2',
      sequence: 3,
      state: CycleState.CLOSED,
      displayMode: DisplayMode.WEIGHTED,
      openedAt,
      closedAt,
      publishedAt: null,
    });
    const survey = { ...makeSurveyRow(), cycles: [cycle], _count: { questions: 0 } };
    vi.mocked(prisma.survey.findMany).mockResolvedValue([survey] as never);

    const result = await service.listAllSurveys();

    const c = result[0].cycles[0];
    expect(c.id).toBe('c-2');
    expect(c.sequence).toBe(3);
    expect(c.state).toBe(CycleState.CLOSED);
    expect(c.displayMode).toBe(DisplayMode.WEIGHTED);
    expect(c.openedAt).toBe(openedAt.toISOString());
    expect(c.closedAt).toBe(closedAt.toISOString());
    expect(c.publishedAt).toBeNull();
  });

  it('returns an empty array when no surveys exist', async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValue([] as never);

    const result = await service.listAllSurveys();

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// listSurveyCycles
// ---------------------------------------------------------------------------

describe('SurveyService.listSurveyCycles', () => {
  let service: SurveyService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    service = await buildModule(prisma);
  });

  it('returns cycles ordered by sequence', async () => {
    const cycles = [
      makeCycleRow({ id: 'c-1', sequence: 1 }),
      makeCycleRow({ id: 'c-2', sequence: 2, state: CycleState.CLOSED }),
    ];
    vi.mocked(prisma.surveyCycle.findMany).mockResolvedValue(cycles as never);

    const result = await service.listSurveyCycles('survey-1');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('c-1');
    expect(result[1].id).toBe('c-2');
  });

  it('queries Prisma with surveyId filter', async () => {
    vi.mocked(prisma.surveyCycle.findMany).mockResolvedValue([] as never);

    await service.listSurveyCycles('survey-abc');

    expect(prisma.surveyCycle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { surveyId: 'survey-abc' },
      }),
    );
  });

  it('returns empty array when survey has no cycles', async () => {
    vi.mocked(prisma.surveyCycle.findMany).mockResolvedValue([] as never);

    const result = await service.listSurveyCycles('survey-none');

    expect(result).toEqual([]);
  });
});
