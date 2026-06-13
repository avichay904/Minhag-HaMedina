import { describe, expect, it } from 'vitest';
import {
  ENDPOINTS,
  buildPath,
  createQuestionRequestSchema,
  socialLoginRequestSchema,
  updateProfileRequestSchema,
  uploadImageResponseSchema,
  createSurveyRequestSchema,
  createSourceRequestSchema,
  updateSourceRequestSchema,
  adminQuestionDtoSchema,
} from '../src/index.js';

describe('endpoints', () => {
  it('exposes all 26 routes (19 Phase-A + 7 admin)', () => {
    expect(Object.keys(ENDPOINTS)).toHaveLength(26);
  });
  it('includes the image-upload route', () => {
    expect(ENDPOINTS.uploadImage).toEqual({ method: 'POST', path: '/uploads/image' });
  });
  it('includes the public community-stats route', () => {
    expect(ENDPOINTS.communityStats).toEqual({ method: 'GET', path: '/stats/community' });
  });
  it('includes the public proof-of-work challenge route', () => {
    expect(ENDPOINTS.powChallenge).toEqual({ method: 'GET', path: '/auth/pow-challenge' });
  });
  it('builds parameterised paths', () => {
    expect(buildPath(ENDPOINTS.surveyQuestions.path, { id: 'abc' })).toBe('/surveys/abc/questions');
    expect(() => buildPath(ENDPOINTS.surveyQuestions.path, {})).toThrow();
  });

  // Admin endpoints
  it('includes admin create-survey route', () => {
    expect(ENDPOINTS.adminCreateSurvey).toEqual({ method: 'POST', path: '/surveys' });
  });
  it('includes admin list-surveys route', () => {
    expect(ENDPOINTS.adminListSurveys).toEqual({ method: 'GET', path: '/surveys' });
  });
  it('includes admin list-survey-cycles route', () => {
    expect(ENDPOINTS.adminListSurveyCycles).toEqual({ method: 'GET', path: '/surveys/:id/cycles' });
  });
  it('includes admin list-questions route', () => {
    expect(ENDPOINTS.adminListQuestions).toEqual({ method: 'GET', path: '/questions' });
  });
  it('includes admin list-sources route', () => {
    expect(ENDPOINTS.adminListSources).toEqual({ method: 'GET', path: '/sources' });
  });
  it('includes admin create-source route', () => {
    expect(ENDPOINTS.adminCreateSource).toEqual({ method: 'POST', path: '/sources' });
  });
  it('includes admin update-source route', () => {
    expect(ENDPOINTS.adminUpdateSource).toEqual({ method: 'PATCH', path: '/sources/:id' });
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

  it('uploadImageResponseSchema accepts a url string', () => {
    expect(uploadImageResponseSchema.safeParse({ url: '/uploads/image.png' }).success).toBe(true);
    expect(uploadImageResponseSchema.safeParse({}).success).toBe(false);
  });

  it('createSurveyRequestSchema requires bilingual titles', () => {
    expect(createSurveyRequestSchema.safeParse({ titleHe: 'א', titleEn: 'B' }).success).toBe(true);
    expect(createSurveyRequestSchema.safeParse({ titleHe: 'א', titleEn: 'B', cadence: 'MONTHLY' }).success).toBe(true);
    expect(createSurveyRequestSchema.safeParse({ titleHe: 'א' }).success).toBe(false);
  });

  it('createSourceRequestSchema requires a name', () => {
    expect(createSourceRequestSchema.safeParse({ name: 'Src' }).success).toBe(true);
    expect(createSourceRequestSchema.safeParse({}).success).toBe(false);
    expect(
      createSourceRequestSchema.safeParse({ name: 'Src', trustScoreMin: 0.4, trustScoreMax: 0.8 }).success,
    ).toBe(true);
  });

  it('updateSourceRequestSchema accepts partial fields', () => {
    expect(updateSourceRequestSchema.safeParse({ active: false }).success).toBe(true);
    expect(updateSourceRequestSchema.safeParse({}).success).toBe(true);
    expect(updateSourceRequestSchema.safeParse({ trustScoreMin: 1.5 }).success).toBe(false);
  });

  it('adminQuestionDtoSchema includes targeting and active fields', () => {
    const valid = {
      id: 'q-1',
      surveyId: 's-1',
      category: 'GENERAL',
      type: 'YES_NO',
      textHe: 'שאלה',
      textEn: 'Q',
      scaleMin: null,
      scaleMax: null,
      options: null,
      imageUrl: null,
      targeting: null,
      active: true,
      expiresAfterCycles: null,
      startCycleSequence: 1,
      createdAt: new Date().toISOString(),
    };
    expect(adminQuestionDtoSchema.safeParse(valid).success).toBe(true);
  });
});
