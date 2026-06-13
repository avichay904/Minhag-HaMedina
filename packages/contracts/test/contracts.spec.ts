import { describe, expect, it } from 'vitest';
import {
  ENDPOINTS,
  buildPath,
  createQuestionRequestSchema,
  socialLoginRequestSchema,
  updateProfileRequestSchema,
  uploadImageResponseSchema,
} from '../src/index.js';

describe('endpoints', () => {
  it('exposes all 19 Phase-A routes', () => {
    expect(Object.keys(ENDPOINTS)).toHaveLength(19);
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
});
