import { describe, expect, it } from 'vitest';
import {
  Category,
  QuestionType,
  filterServableQuestions,
  isExpired,
  type RespondentContext,
  type ServableQuestion,
} from '../src/index.js';

const ctx: RespondentContext = { trustScore: 1.0, age: 30, language: 'HE' };

function q(id: string, over: Partial<ServableQuestion> = {}): ServableQuestion {
  return {
    id,
    type: QuestionType.YES_NO,
    category: Category.GENERAL,
    active: true,
    targeting: {},
    ...over,
  };
}

describe('isExpired', () => {
  it('is never expired when expiresAfterCycles is null', () => {
    expect(isExpired({ expiresAfterCycles: null, ageInCycles: 99 })).toBe(false);
  });
  it('expires once age reaches the configured lifespan', () => {
    expect(isExpired({ expiresAfterCycles: 1, ageInCycles: 0 })).toBe(false);
    expect(isExpired({ expiresAfterCycles: 1, ageInCycles: 1 })).toBe(true);
  });
});

describe('filterServableQuestions', () => {
  it('never repeats answered/skipped questions (full memory)', () => {
    const result = filterServableQuestions([q('a'), q('b'), q('c')], {
      answeredQuestionIds: ['b'],
      ctx,
    });
    expect(result.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('drops inactive and expired questions', () => {
    const result = filterServableQuestions(
      [q('a', { active: false }), q('b', { expiresAfterCycles: 1, ageInCycles: 2 }), q('c')],
      { answeredQuestionIds: [], ctx },
    );
    expect(result.map((x) => x.id)).toEqual(['c']);
  });

  it('auto-skips questions that fail targeting (silently)', () => {
    const anon: RespondentContext = { trustScore: 0.4, language: 'HE' };
    const result = filterServableQuestions(
      [q('general'), q('targeted', { targeting: { gender: 'MALE' } })],
      { answeredQuestionIds: [], ctx: anon },
    );
    expect(result.map((x) => x.id)).toEqual(['general']);
  });

  it('preserves input order', () => {
    const result = filterServableQuestions([q('z'), q('y'), q('x')], {
      answeredQuestionIds: [],
      ctx,
    });
    expect(result.map((x) => x.id)).toEqual(['z', 'y', 'x']);
  });
});
