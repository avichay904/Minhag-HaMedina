/**
 * Cross-module service contracts (interfaces + DI tokens).
 *
 * These are FROZEN in Phase 0 so worker agents can build mutually dependent modules
 * fully in parallel: a consumer module injects a token + interface from here and never
 * imports another module's concrete class. Each provider module binds its concrete
 * implementation to the token and `exports` it; consumers `imports: [ProviderModule]`
 * and `@Inject(TOKEN)`.
 */
import type {
  BadgeType,
  Category,
  CycleState,
  DisplayMode,
  QuestionType,
  Rank,
  RankProgress,
  RespondentContext,
} from '@mhm/shared';
import type { QuestionDto } from '@mhm/contracts';

// ----------------------------------------------------------------- Gamification
export const GAMIFICATION_SERVICE = 'GAMIFICATION_SERVICE';

export interface ResponseGamificationInput {
  respondentId: string;
  questionId: string;
  category: Category;
  questionType: QuestionType;
  cycleId: string;
  skipped: boolean;
  /** Did this interaction count as "seen" for the weekly challenge? */
  seen: boolean;
  answerTimeMs?: number;
}

export interface ChallengeProgressView {
  target: number;
  countAnswered: number;
  countSeen: number;
  completed: boolean;
}

export interface ResponseGamificationResult {
  pointsEarned: number;
  newBadges: BadgeType[];
  challengeProgress: ChallengeProgressView | null;
}

export interface ProfileGamification {
  rank: Rank;
  badges: BadgeType[];
  points: number;
  surveysCompleted: number;
  rankProgress: RankProgress;
}

export interface IGamificationService {
  /** Called by ResponseModule after a response/skip is persisted. */
  onResponseRecorded(input: ResponseGamificationInput): Promise<ResponseGamificationResult>;
  /** Called by CycleModule when a cycle opens. */
  generateChallengeForCycle(cycleId: string): Promise<void>;
  /** Used by RespondentModule + ResultsModule (leaderboard). */
  getProfileGamification(respondentId: string): Promise<ProfileGamification>;
}

// ----------------------------------------------------------------- Anti-fraud
export const ANTIFRAUD_SERVICE = 'ANTIFRAUD_SERVICE';

export interface AntifraudInput {
  respondentId?: string;
  fingerprintHash?: string;
  ip?: string;
  answerTimeMs?: number;
}

export interface AntifraudResult {
  flagged: boolean;
  reason?: string;
}

export interface IAntifraudService {
  /** Assess a submission; returns a flag decision (never blocks/deletes — SRS §2.3). */
  assess(input: AntifraudInput): Promise<AntifraudResult>;
}

// ----------------------------------------------------------------- Question selection
export const QUESTION_SERVICE = 'QUESTION_SERVICE';

export interface IQuestionService {
  /** Servable questions for a respondent (never-repeat + targeting + active — via @mhm/shared). */
  getServableQuestions(args: {
    surveyId: string;
    ctx: RespondentContext;
    answeredQuestionIds: string[];
  }): Promise<QuestionDto[]>;
  countActiveQuestions(surveyId: string): Promise<number>;
}

// ----------------------------------------------------------------- Cycle
export const CYCLE_SERVICE = 'CYCLE_SERVICE';

export interface CycleInfo {
  id: string;
  surveyId: string;
  sequence: number;
  state: CycleState;
  displayMode: DisplayMode;
  openedAt: Date;
  closedAt: Date | null;
  publishedAt: Date | null;
}

export interface ICycleService {
  getActiveCycle(surveyId: string): Promise<CycleInfo | null>;
}
