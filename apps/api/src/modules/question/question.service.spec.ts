import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Category, QuestionType } from '@mhm/shared';
import type { RespondentContext } from '@mhm/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

import { QuestionService } from './question.service';
import type { CreateQuestionDto } from './dto/question.dto';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const SURVEY_ID = 'survey-uuid-1234';

/** An anonymous-level context (trustScore = 0.4, no demographics). */
const ANON_CTX: RespondentContext = { trustScore: 0.4 };

/** An identified context with full demographics. */
const IDENTIFIED_CTX: RespondentContext = {
  trustScore: 1.0,
  age: 30,
  gender: 'MALE',
  region: 'IL',
  language: 'HE',
};

function makeDbQuestion(overrides: Partial<ReturnType<typeof makeDbQuestion>> = {}) {
  return {
    id: 'q-1',
    surveyId: SURVEY_ID,
    category: Category.GENERAL,
    type: QuestionType.YES_NO,
    textHe: 'שאלה בעברית',
    textEn: 'Question in English',
    scaleMin: null,
    scaleMax: null,
    options: null,
    imageUrl: null,
    expiresAfterCycles: null,
    startCycleSequence: 1,
    targeting: null,
    active: true,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    question: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  };
}

async function buildModule(
  prismaMock: ReturnType<typeof buildPrismaMock>,
): Promise<QuestionService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      QuestionService,
      { provide: PrismaService, useValue: prismaMock },
    ],
  }).compile();

  return module.get(QuestionService);
}

// ---------------------------------------------------------------------------
// getServableQuestions — answered-id exclusion
// ---------------------------------------------------------------------------

describe('QuestionService.getServableQuestions — answered exclusion', () => {
  let service: QuestionService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    service = await buildModule(prisma);
  });

  it('returns all active questions when answeredQuestionIds is empty', async () => {
    const questions = [makeDbQuestion({ id: 'q-1' }), makeDbQuestion({ id: 'q-2' })];
    prisma.question.findMany.mockResolvedValue(questions);

    const result = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX,
      answeredQuestionIds: [],
    });

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(expect.arrayContaining(['q-1', 'q-2']));
  });

  it('excludes questions whose ids appear in answeredQuestionIds', async () => {
    const questions = [
      makeDbQuestion({ id: 'q-1' }),
      makeDbQuestion({ id: 'q-2' }),
      makeDbQuestion({ id: 'q-3' }),
    ];
    prisma.question.findMany.mockResolvedValue(questions);

    const result = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX,
      answeredQuestionIds: ['q-1', 'q-3'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q-2');
  });

  it('returns empty array when all questions have been answered', async () => {
    const questions = [makeDbQuestion({ id: 'q-1' }), makeDbQuestion({ id: 'q-2' })];
    prisma.question.findMany.mockResolvedValue(questions);

    const result = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX,
      answeredQuestionIds: ['q-1', 'q-2'],
    });

    expect(result).toHaveLength(0);
  });

  it('queries prisma with surveyId and active:true', async () => {
    prisma.question.findMany.mockResolvedValue([]);

    await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX,
      answeredQuestionIds: [],
    });

    expect(prisma.question.findMany).toHaveBeenCalledWith({
      where: { surveyId: SURVEY_ID, active: true },
    });
  });
});

// ---------------------------------------------------------------------------
// getServableQuestions — targeting (anonymous gets only general questions)
// ---------------------------------------------------------------------------

describe('QuestionService.getServableQuestions — targeting', () => {
  let service: QuestionService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    service = await buildModule(prisma);
  });

  it('serves general (no targeting) questions to anonymous respondents', async () => {
    const questions = [makeDbQuestion({ id: 'q-general', targeting: null })];
    prisma.question.findMany.mockResolvedValue(questions);

    const result = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX,
      answeredQuestionIds: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q-general');
  });

  it('excludes demographically targeted questions for anonymous respondents', async () => {
    const questions = [
      makeDbQuestion({ id: 'q-general', targeting: null }),
      makeDbQuestion({ id: 'q-targeted', targeting: { gender: 'MALE', ageMin: 20 } }),
    ];
    prisma.question.findMany.mockResolvedValue(questions);

    const result = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX,
      answeredQuestionIds: [],
    });

    // Anonymous gets only the general question; targeted one is excluded
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q-general');
  });

  it('serves demographically targeted questions to matching identified respondents', async () => {
    const questions = [
      makeDbQuestion({ id: 'q-male-il', targeting: { gender: 'MALE', regions: ['IL'] } }),
    ];
    prisma.question.findMany.mockResolvedValue(questions);

    const result = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: IDENTIFIED_CTX, // male, region IL, trustScore 1.0
      answeredQuestionIds: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('q-male-il');
  });

  it('excludes a targeted question when the respondent does not match the demographic', async () => {
    const questions = [
      makeDbQuestion({ id: 'q-female', targeting: { gender: 'FEMALE' } }),
    ];
    prisma.question.findMany.mockResolvedValue(questions);

    const result = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: IDENTIFIED_CTX, // gender = MALE
      answeredQuestionIds: [],
    });

    expect(result).toHaveLength(0);
  });

  it('excludes questions whose minTrustScore exceeds respondent trust', async () => {
    const questions = [
      makeDbQuestion({ id: 'q-high-trust', targeting: { minTrustScore: 0.9 } }),
    ];
    prisma.question.findMany.mockResolvedValue(questions);

    const result = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX, // trustScore = 0.4
      answeredQuestionIds: [],
    });

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getServableQuestions — DTO field mapping
// ---------------------------------------------------------------------------

describe('QuestionService.getServableQuestions — DTO mapping', () => {
  let service: QuestionService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    service = await buildModule(prisma);
  });

  it('maps scale fields (scaleMin / scaleMax) correctly', async () => {
    const question = makeDbQuestion({
      id: 'q-scale',
      type: QuestionType.SCALE,
      scaleMin: 1,
      scaleMax: 10,
      targeting: null,
    });
    prisma.question.findMany.mockResolvedValue([question]);

    const [dto] = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX,
      answeredQuestionIds: [],
    });

    expect(dto.scaleMin).toBe(1);
    expect(dto.scaleMax).toBe(10);
  });

  it('maps options array for SINGLE_CHOICE questions', async () => {
    const options = [
      { key: 'a', labelHe: 'כן', labelEn: 'Yes' },
      { key: 'b', labelHe: 'לא', labelEn: 'No' },
    ];
    const question = makeDbQuestion({
      id: 'q-choice',
      type: QuestionType.SINGLE_CHOICE,
      options,
      targeting: null,
    });
    prisma.question.findMany.mockResolvedValue([question]);

    const [dto] = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX,
      answeredQuestionIds: [],
    });

    expect(dto.options).toEqual(options);
  });

  it('maps imageUrl when present', async () => {
    const question = makeDbQuestion({
      id: 'q-img',
      type: QuestionType.TEXT_IMAGE,
      imageUrl: 'https://example.com/img.png',
      targeting: null,
    });
    prisma.question.findMany.mockResolvedValue([question]);

    const [dto] = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX,
      answeredQuestionIds: [],
    });

    expect(dto.imageUrl).toBe('https://example.com/img.png');
  });

  it('sets options to null and scaleMin/scaleMax to null for YES_NO questions', async () => {
    const question = makeDbQuestion({
      id: 'q-yesno',
      type: QuestionType.YES_NO,
      options: null,
      scaleMin: null,
      scaleMax: null,
      targeting: null,
    });
    prisma.question.findMany.mockResolvedValue([question]);

    const [dto] = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX,
      answeredQuestionIds: [],
    });

    expect(dto.options).toBeNull();
    expect(dto.scaleMin).toBeNull();
    expect(dto.scaleMax).toBeNull();
  });

  it('includes surveyId, category, type, textHe, textEn in the returned DTO', async () => {
    const question = makeDbQuestion({
      id: 'q-full',
      surveyId: SURVEY_ID,
      category: Category.TECHNOLOGY,
      type: QuestionType.YES_NO,
      textHe: 'האם אתה משתמש בבינה מלאכותית?',
      textEn: 'Do you use AI?',
      targeting: null,
    });
    prisma.question.findMany.mockResolvedValue([question]);

    const [dto] = await service.getServableQuestions({
      surveyId: SURVEY_ID,
      ctx: ANON_CTX,
      answeredQuestionIds: [],
    });

    expect(dto.surveyId).toBe(SURVEY_ID);
    expect(dto.category).toBe(Category.TECHNOLOGY);
    expect(dto.type).toBe(QuestionType.YES_NO);
    expect(dto.textHe).toBe('האם אתה משתמש בבינה מלאכותית?');
    expect(dto.textEn).toBe('Do you use AI?');
  });
});

// ---------------------------------------------------------------------------
// countActiveQuestions
// ---------------------------------------------------------------------------

describe('QuestionService.countActiveQuestions', () => {
  let service: QuestionService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    service = await buildModule(prisma);
  });

  it('delegates to prisma.question.count with surveyId and active:true', async () => {
    prisma.question.count.mockResolvedValue(7);

    const result = await service.countActiveQuestions(SURVEY_ID);

    expect(result).toBe(7);
    expect(prisma.question.count).toHaveBeenCalledWith({
      where: { surveyId: SURVEY_ID, active: true },
    });
  });

  it('returns 0 when there are no active questions', async () => {
    prisma.question.count.mockResolvedValue(0);

    const result = await service.countActiveQuestions(SURVEY_ID);

    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// createQuestion — bilingual validation (Zod covers these but we also test
// that our service doesn't break the contract at service layer)
// ---------------------------------------------------------------------------

describe('QuestionService.createQuestion — additional business-rule validation', () => {
  let service: QuestionService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    service = await buildModule(prisma);
  });

  it('throws BadRequestException when scaleMin >= scaleMax for SCALE questions', async () => {
    const dto = {
      surveyId: SURVEY_ID,
      category: Category.GENERAL,
      textHe: 'שאלת סולם',
      textEn: 'Scale question',
      type: QuestionType.SCALE,
      scaleMin: 10,
      scaleMax: 5,
    } as unknown as CreateQuestionDto;

    await expect(service.createQuestion(dto)).rejects.toThrow(BadRequestException);
    await expect(service.createQuestion(dto)).rejects.toThrow('scaleMin must be less than scaleMax');
  });

  it('throws BadRequestException when scaleMin equals scaleMax for SCALE questions', async () => {
    const dto = {
      surveyId: SURVEY_ID,
      category: Category.GENERAL,
      textHe: 'שאלת סולם',
      textEn: 'Scale question',
      type: QuestionType.SCALE,
      scaleMin: 5,
      scaleMax: 5,
    } as unknown as CreateQuestionDto;

    await expect(service.createQuestion(dto)).rejects.toThrow(BadRequestException);
  });

  it('does not throw when scaleMin < scaleMax for SCALE questions', async () => {
    const created = makeDbQuestion({
      type: QuestionType.SCALE,
      scaleMin: 1,
      scaleMax: 10,
    });
    prisma.question.create.mockResolvedValue(created);

    const dto = {
      surveyId: SURVEY_ID,
      category: Category.GENERAL,
      textHe: 'שאלת סולם',
      textEn: 'Scale question',
      type: QuestionType.SCALE,
      scaleMin: 1,
      scaleMax: 10,
    } as unknown as CreateQuestionDto;

    await expect(service.createQuestion(dto)).resolves.toBeDefined();
  });

  it('throws BadRequestException when SINGLE_CHOICE options have duplicate keys', async () => {
    const dto = {
      surveyId: SURVEY_ID,
      category: Category.GENERAL,
      textHe: 'שאלה עם אפשרויות',
      textEn: 'Single choice question',
      type: QuestionType.SINGLE_CHOICE,
      options: [
        { key: 'a', labelHe: 'כן', labelEn: 'Yes' },
        { key: 'a', labelHe: 'לא', labelEn: 'No' }, // duplicate key
      ],
    } as unknown as CreateQuestionDto;

    await expect(service.createQuestion(dto)).rejects.toThrow(BadRequestException);
    await expect(service.createQuestion(dto)).rejects.toThrow('option keys must be unique');
  });

  it('does not throw when SINGLE_CHOICE options have unique keys', async () => {
    const created = makeDbQuestion({
      type: QuestionType.SINGLE_CHOICE,
      options: [
        { key: 'a', labelHe: 'כן', labelEn: 'Yes' },
        { key: 'b', labelHe: 'לא', labelEn: 'No' },
      ],
    });
    prisma.question.create.mockResolvedValue(created);

    const dto = {
      surveyId: SURVEY_ID,
      category: Category.GENERAL,
      textHe: 'שאלה עם אפשרויות',
      textEn: 'Single choice question',
      type: QuestionType.SINGLE_CHOICE,
      options: [
        { key: 'a', labelHe: 'כן', labelEn: 'Yes' },
        { key: 'b', labelHe: 'לא', labelEn: 'No' },
      ],
    } as unknown as CreateQuestionDto;

    await expect(service.createQuestion(dto)).resolves.toBeDefined();
  });

  it('creates the question and returns a QuestionDto with correct fields', async () => {
    const created = makeDbQuestion({
      id: 'new-q',
      type: QuestionType.YES_NO,
      textHe: 'שאלה חדשה',
      textEn: 'New question',
      category: Category.SOCIETY_POLITICS,
    });
    prisma.question.create.mockResolvedValue(created);

    const dto = {
      surveyId: SURVEY_ID,
      category: Category.SOCIETY_POLITICS,
      textHe: 'שאלה חדשה',
      textEn: 'New question',
      type: QuestionType.YES_NO,
    } as unknown as CreateQuestionDto;

    const result = await service.createQuestion(dto);

    expect(result.id).toBe('new-q');
    expect(result.textHe).toBe('שאלה חדשה');
    expect(result.textEn).toBe('New question');
    expect(result.category).toBe(Category.SOCIETY_POLITICS);
    expect(result.type).toBe(QuestionType.YES_NO);
  });

  it('stores targeting as {} when not provided', async () => {
    const created = makeDbQuestion({ targeting: {} });
    prisma.question.create.mockResolvedValue(created);

    const dto = {
      surveyId: SURVEY_ID,
      category: Category.GENERAL,
      textHe: 'שאלה',
      textEn: 'Question',
      type: QuestionType.YES_NO,
    } as unknown as CreateQuestionDto;

    await service.createQuestion(dto);

    const callArg = prisma.question.create.mock.calls[0][0];
    expect(callArg.data.targeting).toEqual({});
  });

  it('stores provided targeting object', async () => {
    const targeting = { gender: 'FEMALE', ageMin: 18 };
    const created = makeDbQuestion({ targeting });
    prisma.question.create.mockResolvedValue(created);

    const dto = {
      surveyId: SURVEY_ID,
      category: Category.GENERAL,
      textHe: 'שאלה',
      textEn: 'Question',
      type: QuestionType.YES_NO,
      targeting,
    } as unknown as CreateQuestionDto;

    await service.createQuestion(dto);

    const callArg = prisma.question.create.mock.calls[0][0];
    expect(callArg.data.targeting).toEqual(targeting);
  });

  it('creates question with startCycleSequence defaulting to 1 and active:true', async () => {
    const created = makeDbQuestion();
    prisma.question.create.mockResolvedValue(created);

    const dto = {
      surveyId: SURVEY_ID,
      category: Category.GENERAL,
      textHe: 'שאלה',
      textEn: 'Question',
      type: QuestionType.YES_NO,
    } as unknown as CreateQuestionDto;

    await service.createQuestion(dto);

    const callArg = prisma.question.create.mock.calls[0][0];
    expect(callArg.data.startCycleSequence).toBe(1);
    expect(callArg.data.active).toBe(true);
  });
});
