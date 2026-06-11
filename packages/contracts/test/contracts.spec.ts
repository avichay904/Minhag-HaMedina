import { describe, expect, it } from 'vitest';
import {
  ENDPOINTS,
  buildPath,
  createQuestionRequestSchema,
  socialLoginRequestSchema,
  updateProfileRequestSchema,
} from '../src/index.js';

describe('endpoints', () => {
  it('exposes all 16 Phase-A routes', () => {
    expect(Object.keys(ENDPOINTS)).toHaveLength(16);
  });
  it('builds parameterised paths', () => {
    expect(buildPath(ENDPOINTS.surveyQuestions.path, { id: 'abc' })).toBe('/surveys/abc/questions');
    expect(() => buildPath(ENDPOINTS.surveyQuestions.path, {})).toThrow();
  });
});

describe('schemas', () => {
  it('accepts a valid social login', () => {
    expect(socialLoginRequestSchema.safeParse({ provider: 'GOOGLE', token: 'x' }).success).toBe(true);
    expect(socialLoginRequestSchema.safeParse({ provider: 'FINGERPRINT', token: 'x' }).success).toBe(false);
  });

  it('requires scale bounds for scale questions', () => {
    const base = { surveyId: '00000000-0000-0000-0000-000000000000', category: 'GENERAL', textHe: 'a', textEn: 'b' };
    expect(createQuestionRequestSchema.safeParse({ ...base, type: 'SCALE' }).success).toBe(false);
    expect(
      createQuestionRequestSchema.safeParse({ ...base, type: 'SCALE', scaleMin: 1, scaleMax: 5 }).success,
    ).toBe(true);
  });

  it('rejects unknown profile fields (strict)', () => {
    expect(updateProfileRequestSchema.safeParse({ nickname: 'cool_kid' }).success).toBe(true);
    expect(updateProfileRequestSchema.safeParse({ hacker: true }).success).toBe(false);
  });
});
