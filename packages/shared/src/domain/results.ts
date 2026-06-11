import { DisplayMode, QuestionType } from '../enums.js';
import type {
  DistributionEntry,
  RawResult,
  ResponseLike,
  ResultSummary,
  WeightedResult,
} from '../types.js';

/** Weighted aggregation (SRS §4.3): Σ(value×trust) / Σ(trust). */
export function computeWeighted(items: { value: number; trust: number }[]): WeightedResult {
  let weightedTotal = 0;
  let weightedCount = 0;
  for (const { value, trust } of items) {
    weightedTotal += value * trust;
    weightedCount += trust;
  }
  return {
    weightedTotal: round4(weightedTotal),
    weightedCount: round4(weightedCount),
    weightedResult: weightedCount > 0 ? round4(weightedTotal / weightedCount) : null,
  };
}

/** Unweighted ("raw") aggregation. */
export function computeRaw(values: number[]): RawResult {
  let rawTotal = 0;
  for (const v of values) rawTotal += v;
  return {
    rawTotal: round4(rawTotal),
    rawCount: values.length,
    rawAverage: values.length > 0 ? round4(rawTotal / values.length) : null,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

const isNumericType = (t: QuestionType): boolean =>
  t === QuestionType.YES_NO || t === QuestionType.SCALE;

/**
 * Aggregate all responses for a single question into a public/admin-ready summary.
 * Skipped or non-counted responses are excluded from the maths.
 * The shape honours `displayMode` (RAW | WEIGHTED | BOTH).
 */
export function aggregateResult(
  responses: ResponseLike[],
  opts: { questionType: QuestionType; displayMode: DisplayMode },
): ResultSummary {
  const { questionType, displayMode } = opts;
  const answered = responses.filter((r) => !r.skipped && r.answerValue != null);
  const skippedCount = responses.filter((r) => r.skipped).length;

  const summary: ResultSummary = {
    questionType,
    totalResponses: answered.length,
    skippedCount,
    displayMode,
  };

  const wantRaw = displayMode === DisplayMode.RAW || displayMode === DisplayMode.BOTH;
  const wantWeighted = displayMode === DisplayMode.WEIGHTED || displayMode === DisplayMode.BOTH;

  if (isNumericType(questionType)) {
    const counted = answered.filter((r) => r.rawCounted);
    const numeric = counted.map((r) => ({ value: Number(r.answerValue), trust: r.trustScore }));
    if (wantRaw) summary.raw = computeRaw(numeric.map((n) => n.value));
    if (wantWeighted) summary.weighted = computeWeighted(numeric);
  } else {
    // SINGLE_CHOICE / TEXT_IMAGE → distribution by answer key.
    summary.distribution = buildDistribution(
      answered
        .filter((r) => r.rawCounted)
        .map((r) => ({ key: String(r.answerValue), trust: r.trustScore })),
    );
  }

  return summary;
}

/** Count occurrences per answer key, both raw and trust-weighted. */
export function buildDistribution(entries: { key: string; trust: number }[]): DistributionEntry[] {
  const map = new Map<string, DistributionEntry>();
  for (const { key, trust } of entries) {
    const existing = map.get(key) ?? { key, rawCount: 0, weightedCount: 0 };
    existing.rawCount += 1;
    existing.weightedCount = round4(existing.weightedCount + trust);
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.weightedCount - a.weightedCount);
}
