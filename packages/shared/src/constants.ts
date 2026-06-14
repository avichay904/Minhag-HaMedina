import { AuthProvider, Rank, type Category } from './enums.js';

/** The only Trust Score values the system recognises. */
export const VALID_TRUST_SCORES = [0.4, 0.6, 0.7, 0.8, 1.0] as const;

export const ANONYMOUS_TRUST = 0.4;
export const DEFAULT_MIN_TRUST = 0.4;

/** Base Trust Score per authentication method (SRS §2.1). */
export const TRUST_SCORES: Record<AuthProvider, number> = {
  [AuthProvider.GOOGLE]: 1.0,
  [AuthProvider.APPLE]: 1.0,
  [AuthProvider.EMAIL]: 1.0,
  [AuthProvider.FINGERPRINT]: 0.7,
  [AuthProvider.ANONYMOUS]: 0.4,
  [AuthProvider.EXTERNAL_AUTHORIZED]: 1.0,
  [AuthProvider.EXTERNAL_UNIDENTIFIED]: 0.6,
  [AuthProvider.EXTERNAL_AUTHENTICATED]: 0.7,
  [AuthProvider.EXTERNAL_UNKNOWN]: 0.4,
  [AuthProvider.IVR]: 0.8,
};

export const EXTERNAL_PROVIDERS: AuthProvider[] = [
  AuthProvider.EXTERNAL_AUTHORIZED,
  AuthProvider.EXTERNAL_UNIDENTIFIED,
  AuthProvider.EXTERNAL_AUTHENTICATED,
  AuthProvider.EXTERNAL_UNKNOWN,
];

/** Rank thresholds (SRS §5.1): minimum surveys completed + minimum trust score. */
export interface RankThreshold {
  minSurveys: number;
  minTrust: number;
}

export const RANK_ORDER: Rank[] = [
  Rank.GUEST,
  Rank.BEGINNER,
  Rank.CONTRIBUTOR,
  Rank.VETERAN,
  Rank.AMBASSADOR,
];

export const RANK_THRESHOLDS: Record<Rank, RankThreshold> = {
  [Rank.GUEST]: { minSurveys: 0, minTrust: 0.4 },
  [Rank.BEGINNER]: { minSurveys: 3, minTrust: 0.4 },
  [Rank.CONTRIBUTOR]: { minSurveys: 10, minTrust: 0.7 },
  [Rank.VETERAN]: { minSurveys: 25, minTrust: 0.7 },
  [Rank.AMBASSADOR]: { minSurveys: 50, minTrust: 1.0 },
};

/** Weekly challenge generation parameters (SRS §5.3). */
export const CHALLENGE_PARAMS = {
  minTarget: 3,
  avgMultiplier: 1.1,
  rankBonusPerStep: 0.1,
  ceilingRatio: 0.8,
  fullCompletionBonus: 3,
  almostThreshold: 0.7,
  almostBonus: 1,
} as const;

/** Badge award rules (SRS §5.2). */
export const BADGE_RULES = {
  streakWeeks: 4,
  fastMaxAvgSeconds: 5,
  challengeCount: 5,
  almostRatio: 0.7,
} as const;

/** Nickname rules (SRS §5.4). */
export const NICKNAME_RULES = {
  regex: /^[A-Za-z0-9_]{3,20}$/,
  minLength: 3,
  maxLength: 20,
  changeIntervalDays: 30,
} as const;

/** Categories that are always considered "general" (never demographically targeted). */
export const GENERAL_CATEGORY: Category = 'GENERAL';
