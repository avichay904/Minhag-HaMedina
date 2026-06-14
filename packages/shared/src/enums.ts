/**
 * Domain enums, declared as `const` objects + derived union types.
 *
 * This mirrors exactly how Prisma Client generates its enums, so values produced
 * by the database layer (plain strings like `'GOOGLE'`) are directly assignable to
 * these union types — no nominal-enum friction between packages.
 */

export const AuthProvider = {
  GOOGLE: 'GOOGLE',
  APPLE: 'APPLE',
  EMAIL: 'EMAIL',
  FINGERPRINT: 'FINGERPRINT',
  ANONYMOUS: 'ANONYMOUS',
  EXTERNAL_AUTHORIZED: 'EXTERNAL_AUTHORIZED',
  EXTERNAL_UNIDENTIFIED: 'EXTERNAL_UNIDENTIFIED',
  EXTERNAL_AUTHENTICATED: 'EXTERNAL_AUTHENTICATED',
  EXTERNAL_UNKNOWN: 'EXTERNAL_UNKNOWN',
  IVR: 'IVR',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const QuestionType = {
  YES_NO: 'YES_NO',
  SCALE: 'SCALE',
  SINGLE_CHOICE: 'SINGLE_CHOICE',
  TEXT_IMAGE: 'TEXT_IMAGE',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const Category = {
  SOCIETY_POLITICS: 'SOCIETY_POLITICS',
  CONSUMER: 'CONSUMER',
  HEALTH_LIFESTYLE: 'HEALTH_LIFESTYLE',
  TECHNOLOGY: 'TECHNOLOGY',
  PERSONAL_FINANCE: 'PERSONAL_FINANCE',
  GENERAL: 'GENERAL',
} as const;
export type Category = (typeof Category)[keyof typeof Category];

export const ALL_CATEGORIES: Category[] = Object.values(Category);

/** Respondent demographic gender. */
export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

/** Targeting gender selector (adds ALL). Stored inside the Question.targeting JSON. */
export const TargetGender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  ALL: 'ALL',
} as const;
export type TargetGender = (typeof TargetGender)[keyof typeof TargetGender];

/** Respondent / UI language. */
export const Language = {
  HE: 'HE',
  EN: 'EN',
} as const;
export type Language = (typeof Language)[keyof typeof Language];

/** Targeting language selector (adds ALL). */
export const TargetLanguage = {
  HE: 'HE',
  EN: 'EN',
  ALL: 'ALL',
} as const;
export type TargetLanguage = (typeof TargetLanguage)[keyof typeof TargetLanguage];

export const Rank = {
  GUEST: 'GUEST',
  BEGINNER: 'BEGINNER',
  CONTRIBUTOR: 'CONTRIBUTOR',
  VETERAN: 'VETERAN',
  AMBASSADOR: 'AMBASSADOR',
} as const;
export type Rank = (typeof Rank)[keyof typeof Rank];

export const BadgeType = {
  STREAK: 'STREAK',
  FAST: 'FAST',
  DIVERSE: 'DIVERSE',
  CHALLENGE: 'CHALLENGE',
  CHALLENGE_OF_WEEK: 'CHALLENGE_OF_WEEK',
  ALMOST: 'ALMOST',
} as const;
export type BadgeType = (typeof BadgeType)[keyof typeof BadgeType];

export const DisplayMode = {
  RAW: 'RAW',
  WEIGHTED: 'WEIGHTED',
  BOTH: 'BOTH',
} as const;
export type DisplayMode = (typeof DisplayMode)[keyof typeof DisplayMode];

export const CycleState = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  APPROVED: 'APPROVED',
  PUBLISHED: 'PUBLISHED',
} as const;
export type CycleState = (typeof CycleState)[keyof typeof CycleState];

export const XSource = {
  WEB: 'WEB',
  APP: 'APP',
  EXTERNAL: 'EXTERNAL',
} as const;
export type XSource = (typeof XSource)[keyof typeof XSource];

export const Cadence = {
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
} as const;
export type Cadence = (typeof Cadence)[keyof typeof Cadence];
