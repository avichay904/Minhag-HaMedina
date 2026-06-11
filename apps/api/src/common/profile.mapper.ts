import type { RespondentProfile } from '@mhm/contracts';
import { type Category, displayName, type Demographics, type Language } from '@mhm/shared';
import type { ProfileGamification } from './facades';

/** Structural shape of the fields this mapper needs from a Respondent record. */
export interface RespondentRecord {
  id: string;
  nickname: string | null;
  trustScore: number;
  showInLeaderboard: boolean;
  preferredLanguage: string;
  preferredCategories: unknown;
  age: number | null;
  gender: string | null;
  region: string | null;
}

/**
 * Single source of truth for assembling the public RespondentProfile DTO from a
 * Respondent row + its gamification extras. Used by auth, external, and respondent
 * modules so the profile shape never diverges.
 */
export function buildRespondentProfile(
  r: RespondentRecord,
  g: ProfileGamification,
): RespondentProfile {
  const demographics: Demographics = {
    age: r.age ?? null,
    gender: (r.gender as Demographics['gender']) ?? null,
    region: r.region ?? null,
  };
  return {
    id: r.id,
    nickname: r.nickname ?? null,
    displayName: displayName({ nickname: r.nickname, id: r.id }),
    rank: g.rank,
    badges: g.badges,
    points: g.points,
    trustScore: r.trustScore,
    surveysCompleted: g.surveysCompleted,
    showInLeaderboard: r.showInLeaderboard,
    preferredLanguage: r.preferredLanguage as Language,
    preferredCategories: (Array.isArray(r.preferredCategories)
      ? (r.preferredCategories as Category[])
      : []),
    demographics,
    rankProgress: g.rankProgress,
  };
}
