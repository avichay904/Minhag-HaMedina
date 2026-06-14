import type { RespondentContext, ServableQuestion } from '../types.js';
import { matchesTargeting } from './targeting.js';

/** Has the question outlived its configured cycle lifespan? */
export function isExpired(question: Pick<ServableQuestion, 'ageInCycles' | 'expiresAfterCycles'>): boolean {
  if (question.expiresAfterCycles == null) return false; // null = always active
  if (question.ageInCycles == null) return false;
  return question.ageInCycles >= question.expiresAfterCycles;
}

export interface SelectionOptions {
  /** Question ids the respondent has already answered OR skipped — never show again. */
  answeredQuestionIds: Iterable<string>;
  ctx: RespondentContext;
}

/**
 * Pick the questions that are servable to a respondent right now (SRS §3.3, §3.4, §4.2, §6.1):
 *  - "Full memory": never repeat an answered/skipped question.
 *  - Drop inactive / expired questions.
 *  - Apply targeting; non-matching questions are auto-skipped silently.
 *
 * Pure & deterministic — preserves input order.
 */
export function filterServableQuestions(
  questions: ServableQuestion[],
  opts: SelectionOptions,
): ServableQuestion[] {
  const answered = opts.answeredQuestionIds instanceof Set
    ? opts.answeredQuestionIds
    : new Set(opts.answeredQuestionIds);

  return questions.filter((q) => {
    if (!q.active) return false;
    if (answered.has(q.id)) return false;
    if (isExpired(q)) return false;
    if (!matchesTargeting(q.targeting, opts.ctx)) return false;
    return true;
  });
}
