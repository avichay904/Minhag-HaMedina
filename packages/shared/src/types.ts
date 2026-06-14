import type {
  AuthProvider,
  Category,
  DisplayMode,
  Gender,
  Language,
  QuestionType,
  Rank,
  TargetGender,
  TargetLanguage,
} from './enums.js';

/** Question targeting profile — persisted as JSON on Question.targeting. */
export interface Targeting {
  ageMin?: number | null;
  ageMax?: number | null;
  gender?: TargetGender;
  regions?: string[] | null;
  language?: TargetLanguage;
  minTrustScore?: number;
}

/** Respondent demographics — persisted as JSON on Respondent.demographics. */
export interface Demographics {
  age?: number | null;
  gender?: Gender | null;
  region?: string | null;
}

/** Context describing the respondent at request time (for targeting/selection). */
export interface RespondentContext {
  age?: number | null;
  gender?: Gender | null;
  region?: string | null;
  language?: Language;
  trustScore: number;
}

/** Permission scope for an external source — persisted as JSON on ExternalSource.resultsScope. */
export interface ResultsScope {
  ownRespondentsOnly: boolean;
  categories: Category[];
}

/** Single-choice option (bilingual label). */
export interface ChoiceOption {
  key: string;
  labelHe: string;
  labelEn: string;
}

/** Minimal question shape consumed by the pure selection/targeting logic. */
export interface ServableQuestion {
  id: string;
  type: QuestionType;
  category: Category;
  active: boolean;
  targeting: Targeting;
  /** How many cycles old the question is (for expiry). Optional. */
  ageInCycles?: number;
  expiresAfterCycles?: number | null;
}

/** Minimal response shape consumed by the pure results logic. */
export interface ResponseLike {
  answerValue?: string | number | null;
  skipped: boolean;
  trustScore: number;
  rawCounted: boolean;
}

export interface WeightedResult {
  weightedTotal: number;
  weightedCount: number;
  weightedResult: number | null;
}

export interface RawResult {
  rawTotal: number;
  rawCount: number;
  rawAverage: number | null;
}

export interface DistributionEntry {
  key: string;
  rawCount: number;
  weightedCount: number;
}

/** Aggregated result for one question, shaped per DisplayMode. */
export interface ResultSummary {
  questionType: QuestionType;
  totalResponses: number;
  skippedCount: number;
  displayMode: DisplayMode;
  raw?: RawResult;
  weighted?: WeightedResult;
  distribution?: DistributionEntry[];
}

export interface RankProgress {
  current: Rank;
  next: Rank | null;
  surveysToNext: number | null;
  trustBlockedNext: boolean;
}

export interface BadgeStats {
  consecutiveWeeks: number;
  avgAnswerTimeSec: number | null;
  categoriesAnswered: Category[];
  weeklyChallengesCompleted: number;
  currentChallengeCompleted?: boolean;
  currentChallengeRatio?: number;
}

/** Identity principal attached to each authenticated request. */
export interface Principal {
  type: 'respondent' | 'admin' | 'source';
  respondentId?: string;
  adminId?: string;
  sourceId?: string;
  authProvider?: AuthProvider;
  xSource: 'WEB' | 'APP' | 'EXTERNAL';
  trustScore: number;
}
