import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CycleState, DisplayMode, Rank, BadgeType } from '@mhm/shared';
import { ResultsService } from './results.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makePrisma() {
  return {
    survey: {
      findUnique: vi.fn(),
    },
    surveyCycle: {
      findFirst: vi.fn(),
    },
    question: {
      findMany: vi.fn(),
    },
    response: {
      findMany: vi.fn(),
    },
    respondent: {
      findMany: vi.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof makePrisma>;

function makeService(prisma: PrismaMock): ResultsService {
  return new ResultsService(prisma as any);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAKE_SURVEY = { id: 'survey-1', titleHe: 'סקר', titleEn: 'Survey' };

const FAKE_CYCLE_OPEN = {
  id: 'cycle-1',
  surveyId: 'survey-1',
  sequence: 1,
  state: CycleState.OPEN,
  displayMode: DisplayMode.BOTH,
};

const FAKE_CYCLE_APPROVED = {
  ...FAKE_CYCLE_OPEN,
  state: CycleState.APPROVED,
  displayMode: DisplayMode.BOTH,
};

const FAKE_CYCLE_PUBLISHED = {
  ...FAKE_CYCLE_OPEN,
  state: CycleState.PUBLISHED,
  displayMode: DisplayMode.RAW,
};

const FAKE_QUESTION_YES_NO = {
  id: 'q-1',
  surveyId: 'survey-1',
  type: 'YES_NO',
  textHe: 'שאלה',
  textEn: 'Question',
  category: 'GENERAL',
  active: true,
};

const FAKE_QUESTION_SCALE = {
  id: 'q-scale',
  surveyId: 'survey-1',
  type: 'SCALE',
  textHe: 'דרג',
  textEn: 'Rate it',
  category: 'GENERAL',
  active: true,
};

const FAKE_QUESTION_CHOICE = {
  id: 'q-choice',
  surveyId: 'survey-1',
  type: 'SINGLE_CHOICE',
  textHe: 'בחר',
  textEn: 'Choose',
  category: 'GENERAL',
  active: true,
};

function makeResponse(overrides: Partial<{
  id: string;
  questionId: string;
  respondentId: string | null;
  answerValue: string | null;
  skipped: boolean;
  trustScoreAtSubmission: number;
  rawCounted: boolean;
}> = {}) {
  return {
    id: 'resp-1',
    questionId: 'q-1',
    respondentId: 'respondent-1',
    answerValue: '1',
    skipped: false,
    trustScoreAtSubmission: 1.0,
    rawCounted: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getAdminResults
// ---------------------------------------------------------------------------

describe('ResultsService.getAdminResults', () => {
  let service: ResultsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    service = makeService(prisma);
  });

  it('throws NotFoundException when survey does not exist', async () => {
    prisma.survey.findUnique.mockResolvedValue(null);

    await expect(service.getAdminResults('missing-survey')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when no cycle exists for the survey', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(null);

    await expect(service.getAdminResults('survey-1')).rejects.toThrow(NotFoundException);
  });

  it('returns SurveyResults with displayMode BOTH for admin regardless of cycle state', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_OPEN);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([makeResponse()]);

    const result = await service.getAdminResults('survey-1');

    expect(result.displayMode).toBe(DisplayMode.BOTH);
    expect(result.surveyId).toBe('survey-1');
    expect(result.cycleId).toBe('cycle-1');
  });

  it('returns both raw and weighted when displayMode is BOTH', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_OPEN);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([makeResponse({ answerValue: '1' })]);

    const result = await service.getAdminResults('survey-1');
    const q = result.questions[0];

    expect(q.raw).toBeDefined();
    expect(q.weighted).toBeDefined();
  });

  it('computes totalRespondents as distinct respondentIds', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_OPEN);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([
      makeResponse({ id: 'r-1', respondentId: 'respondent-A', answerValue: '1' }),
      makeResponse({ id: 'r-2', respondentId: 'respondent-B', answerValue: '0' }),
      makeResponse({ id: 'r-3', respondentId: 'respondent-A', answerValue: '1' }), // duplicate
    ]);

    const result = await service.getAdminResults('survey-1');

    expect(result.totalRespondents).toBe(2);
  });

  it('computes correct skipRate: skipped/(answered+skipped)', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_OPEN);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([
      makeResponse({ id: 'r-1', respondentId: 'r-1', answerValue: '1', skipped: false }),
      makeResponse({ id: 'r-2', respondentId: 'r-2', answerValue: null, skipped: true }),
      makeResponse({ id: 'r-3', respondentId: 'r-3', answerValue: null, skipped: true }),
    ]);

    const result = await service.getAdminResults('survey-1');
    const q = result.questions[0];

    // 2 skipped out of 1 answered + 2 skipped = 3 total → 2/3
    expect(q.skipRate).toBeCloseTo(2 / 3);
  });

  it('returns skipRate of 0 when there are no responses', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_OPEN);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([]);

    const result = await service.getAdminResults('survey-1');
    expect(result.questions[0].skipRate).toBe(0);
  });

  it('includes questionId, textHe, textEn on each result summary', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_OPEN);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([]);

    const result = await service.getAdminResults('survey-1');
    const q = result.questions[0];

    expect(q.questionId).toBe('q-1');
    expect(q.textHe).toBe('שאלה');
    expect(q.textEn).toBe('Question');
  });

  it('produces distribution (not raw/weighted) for SINGLE_CHOICE questions', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_OPEN);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_CHOICE]);
    prisma.response.findMany.mockResolvedValue([
      makeResponse({ id: 'r-1', questionId: 'q-choice', answerValue: 'A', skipped: false }),
      makeResponse({ id: 'r-2', questionId: 'q-choice', answerValue: 'B', skipped: false }),
    ]);

    const result = await service.getAdminResults('survey-1');
    const q = result.questions[0];

    expect(q.distribution).toBeDefined();
    expect(q.raw).toBeUndefined();
    expect(q.weighted).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getPublicResults
// ---------------------------------------------------------------------------

describe('ResultsService.getPublicResults', () => {
  let service: ResultsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    service = makeService(prisma);
  });

  it('throws NotFoundException when survey does not exist', async () => {
    prisma.survey.findUnique.mockResolvedValue(null);

    await expect(service.getPublicResults('missing')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when cycle state is OPEN (not published)', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_OPEN);

    await expect(service.getPublicResults('survey-1')).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when cycle state is CLOSED', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue({
      ...FAKE_CYCLE_OPEN,
      state: CycleState.CLOSED,
    });

    await expect(service.getPublicResults('survey-1')).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException with message "Results not yet published" when not approved/published', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_OPEN);

    await expect(service.getPublicResults('survey-1')).rejects.toThrow('Results not yet published');
  });

  it('returns results when cycle is APPROVED', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_APPROVED);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([makeResponse()]);

    const result = await service.getPublicResults('survey-1');

    expect(result.surveyId).toBe('survey-1');
    expect(result.state).toBe(CycleState.APPROVED);
  });

  it('returns results when cycle is PUBLISHED', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_PUBLISHED);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([makeResponse()]);

    const result = await service.getPublicResults('survey-1');

    expect(result.state).toBe(CycleState.PUBLISHED);
  });

  it('honours RAW displayMode: returns only raw, no weighted', async () => {
    const cycleRaw = { ...FAKE_CYCLE_APPROVED, displayMode: DisplayMode.RAW };
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(cycleRaw);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([makeResponse({ answerValue: '1' })]);

    const result = await service.getPublicResults('survey-1');
    const q = result.questions[0];

    expect(result.displayMode).toBe(DisplayMode.RAW);
    expect(q.raw).toBeDefined();
    expect(q.weighted).toBeUndefined();
  });

  it('honours WEIGHTED displayMode: returns only weighted, no raw', async () => {
    const cycleWeighted = { ...FAKE_CYCLE_APPROVED, displayMode: DisplayMode.WEIGHTED };
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(cycleWeighted);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_SCALE]);
    prisma.response.findMany.mockResolvedValue([
      makeResponse({ questionId: 'q-scale', answerValue: '7', trustScoreAtSubmission: 0.8 }),
    ]);

    const result = await service.getPublicResults('survey-1');
    const q = result.questions[0];

    expect(result.displayMode).toBe(DisplayMode.WEIGHTED);
    expect(q.weighted).toBeDefined();
    expect(q.raw).toBeUndefined();
  });

  it('honours BOTH displayMode: returns both raw and weighted', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_APPROVED);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([makeResponse({ answerValue: '1' })]);

    const result = await service.getPublicResults('survey-1');
    const q = result.questions[0];

    expect(result.displayMode).toBe(DisplayMode.BOTH);
    expect(q.raw).toBeDefined();
    expect(q.weighted).toBeDefined();
  });

  it('does not leak per-respondent data: response-level fields absent from result', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_APPROVED);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([makeResponse()]);

    const result = await service.getPublicResults('survey-1');

    // Top-level result must not have any respondentId / answerValue fields
    expect((result as any).respondentId).toBeUndefined();
    expect((result as any).answerValue).toBeUndefined();
    // Questions should not expose individual responses
    const q = result.questions[0];
    expect((q as any).responses).toBeUndefined();
  });

  it('computes totalRespondents correctly on public endpoint', async () => {
    prisma.survey.findUnique.mockResolvedValue(FAKE_SURVEY);
    prisma.surveyCycle.findFirst.mockResolvedValue(FAKE_CYCLE_APPROVED);
    prisma.question.findMany.mockResolvedValue([FAKE_QUESTION_YES_NO]);
    prisma.response.findMany.mockResolvedValue([
      makeResponse({ id: 'r-1', respondentId: 'rA', answerValue: '1' }),
      makeResponse({ id: 'r-2', respondentId: 'rB', answerValue: '0' }),
    ]);

    const result = await service.getPublicResults('survey-1');
    expect(result.totalRespondents).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getLeaderboard
// ---------------------------------------------------------------------------

describe('ResultsService.getLeaderboard', () => {
  let service: ResultsService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrisma();
    service = makeService(prisma);
  });

  it('returns empty array when no opted-in respondents', async () => {
    prisma.respondent.findMany.mockResolvedValue([]);

    const result = await service.getLeaderboard();

    expect(result).toEqual([]);
  });

  it('only returns respondents with showInLeaderboard=true', async () => {
    // The Prisma query is scoped to showInLeaderboard=true; we verify the query arg.
    prisma.respondent.findMany.mockResolvedValue([]);

    await service.getLeaderboard();

    const callArg = prisma.respondent.findMany.mock.calls[0][0];
    expect(callArg.where.showInLeaderboard).toBe(true);
  });

  it('assigns 1-based positions in order', async () => {
    prisma.respondent.findMany.mockResolvedValue([
      { id: 'r-1', nickname: 'Alice', points: 100, answeredCount: 10, trustScore: 1.0, badges: [] },
      { id: 'r-2', nickname: 'Bob', points: 80, answeredCount: 8, trustScore: 0.9, badges: [] },
      { id: 'r-3', nickname: null, points: 50, answeredCount: 5, trustScore: 0.8, badges: [] },
    ]);

    const result = await service.getLeaderboard();

    expect(result[0].position).toBe(1);
    expect(result[1].position).toBe(2);
    expect(result[2].position).toBe(3);
  });

  it('uses nickname as displayName when present', async () => {
    prisma.respondent.findMany.mockResolvedValue([
      { id: 'r-1', nickname: 'Avraham', points: 100, answeredCount: 5, trustScore: 1.0, badges: [] },
    ]);

    const result = await service.getLeaderboard();

    expect(result[0].displayName).toBe('Avraham');
  });

  it('falls back to "User #<id>" when nickname is null', async () => {
    prisma.respondent.findMany.mockResolvedValue([
      { id: 'abc-123', nickname: null, points: 50, answeredCount: 3, trustScore: 0.8, badges: [] },
    ]);

    const result = await service.getLeaderboard();

    expect(result[0].displayName).toBe('User #abc-123');
  });

  it('falls back to "User #<id>" when nickname is empty string', async () => {
    prisma.respondent.findMany.mockResolvedValue([
      { id: 'xyz-999', nickname: '', points: 30, answeredCount: 2, trustScore: 0.7, badges: [] },
    ]);

    const result = await service.getLeaderboard();

    expect(result[0].displayName).toBe('User #xyz-999');
  });

  it('computes rank via rankForStats', async () => {
    // A respondent with 0 surveys → GUEST rank
    prisma.respondent.findMany.mockResolvedValue([
      { id: 'r-1', nickname: 'Alice', points: 0, answeredCount: 0, trustScore: 1.0, badges: [] },
    ]);

    const result = await service.getLeaderboard();

    expect(result[0].rank).toBe(Rank.GUEST);
  });

  it('maps badge types correctly', async () => {
    prisma.respondent.findMany.mockResolvedValue([
      {
        id: 'r-1',
        nickname: 'BadgeHero',
        points: 200,
        answeredCount: 20,
        trustScore: 1.0,
        badges: [{ type: BadgeType.STREAK }, { type: BadgeType.FAST }],
      },
    ]);

    const result = await service.getLeaderboard();

    expect(result[0].badges).toContain(BadgeType.STREAK);
    expect(result[0].badges).toContain(BadgeType.FAST);
  });

  it('includes surveysCompleted and points on each entry', async () => {
    prisma.respondent.findMany.mockResolvedValue([
      { id: 'r-1', nickname: 'Test', points: 999, answeredCount: 42, trustScore: 1.0, badges: [] },
    ]);

    const result = await service.getLeaderboard();

    expect(result[0].surveysCompleted).toBe(42);
    expect(result[0].points).toBe(999);
  });

  it('requests at most 50 entries from Prisma', async () => {
    prisma.respondent.findMany.mockResolvedValue([]);

    await service.getLeaderboard();

    const callArg = prisma.respondent.findMany.mock.calls[0][0];
    expect(callArg.take).toBe(50);
  });

  it('orders by points desc then answeredCount desc', async () => {
    prisma.respondent.findMany.mockResolvedValue([]);

    await service.getLeaderboard();

    const callArg = prisma.respondent.findMany.mock.calls[0][0];
    expect(callArg.orderBy).toEqual([{ points: 'desc' }, { answeredCount: 'desc' }]);
  });

  it('respondents without showInLeaderboard are filtered by the query (not returned)', async () => {
    // Simulate that the Prisma layer only returned opted-in respondents
    prisma.respondent.findMany.mockResolvedValue([
      { id: 'r-1', nickname: 'Opted', points: 100, answeredCount: 5, trustScore: 1.0, badges: [] },
    ]);

    const result = await service.getLeaderboard();

    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('Opted');
  });
});
