import { describe, expect, it } from 'vitest';
import {
  DisplayMode,
  QuestionType,
  aggregateResult,
  computeRaw,
  computeWeighted,
  type ResponseLike,
} from '../src/index.js';

describe('computeWeighted', () => {
  it('computes Σ(v·t)/Σ(t)', () => {
    const r = computeWeighted([
      { value: 1, trust: 1.0 },
      { value: 0, trust: 0.4 },
      { value: 1, trust: 0.7 },
    ]);
    expect(r.weightedTotal).toBe(1.7);
    expect(r.weightedCount).toBe(2.1);
    expect(r.weightedResult).toBeCloseTo(0.8095, 3);
  });

  it('returns null when there are no responses', () => {
    expect(computeWeighted([]).weightedResult).toBeNull();
  });
});

describe('computeRaw', () => {
  it('averages unweighted values', () => {
    expect(computeRaw([1, 0, 1, 1]).rawAverage).toBe(0.75);
    expect(computeRaw([]).rawAverage).toBeNull();
  });
});

describe('aggregateResult', () => {
  const yesNo: ResponseLike[] = [
    { answerValue: 1, skipped: false, trustScore: 1.0, rawCounted: true },
    { answerValue: 0, skipped: false, trustScore: 0.4, rawCounted: true },
    { answerValue: null, skipped: true, trustScore: 1.0, rawCounted: false },
  ];

  it('excludes skipped responses and counts them separately', () => {
    const s = aggregateResult(yesNo, { questionType: QuestionType.YES_NO, displayMode: DisplayMode.BOTH });
    expect(s.totalResponses).toBe(2);
    expect(s.skippedCount).toBe(1);
  });

  it('honours displayMode RAW (no weighted block)', () => {
    const s = aggregateResult(yesNo, { questionType: QuestionType.YES_NO, displayMode: DisplayMode.RAW });
    expect(s.raw).toBeDefined();
    expect(s.weighted).toBeUndefined();
  });

  it('honours displayMode WEIGHTED (no raw block)', () => {
    const s = aggregateResult(yesNo, { questionType: QuestionType.SCALE, displayMode: DisplayMode.WEIGHTED });
    expect(s.weighted).toBeDefined();
    expect(s.raw).toBeUndefined();
  });

  it('builds a distribution for single-choice questions', () => {
    const choices: ResponseLike[] = [
      { answerValue: 'a', skipped: false, trustScore: 1.0, rawCounted: true },
      { answerValue: 'a', skipped: false, trustScore: 0.7, rawCounted: true },
      { answerValue: 'b', skipped: false, trustScore: 0.4, rawCounted: true },
    ];
    const s = aggregateResult(choices, {
      questionType: QuestionType.SINGLE_CHOICE,
      displayMode: DisplayMode.BOTH,
    });
    expect(s.distribution).toEqual([
      { key: 'a', rawCount: 2, weightedCount: 1.7 },
      { key: 'b', rawCount: 1, weightedCount: 0.4 },
    ]);
  });
});
