import { z } from 'zod';
import { BadgeType, Category, Language, Rank } from '@mhm/shared';
import { demographicsSchema } from './common.schema.js';

export const rankProgressSchema = z.object({
  current: z.nativeEnum(Rank),
  next: z.nativeEnum(Rank).nullable(),
  surveysToNext: z.number().nullable(),
  trustBlockedNext: z.boolean(),
});
export type RankProgressDto = z.infer<typeof rankProgressSchema>;

export const respondentProfileSchema = z.object({
  id: z.string(),
  nickname: z.string().nullable(),
  displayName: z.string(),
  rank: z.nativeEnum(Rank),
  badges: z.array(z.nativeEnum(BadgeType)),
  points: z.number(),
  trustScore: z.number(),
  surveysCompleted: z.number(),
  showInLeaderboard: z.boolean(),
  preferredLanguage: z.nativeEnum(Language),
  preferredCategories: z.array(z.nativeEnum(Category)),
  demographics: demographicsSchema.nullable(),
  rankProgress: rankProgressSchema,
});
export type RespondentProfile = z.infer<typeof respondentProfileSchema>;

export const updateProfileRequestSchema = z
  .object({
    nickname: z.string().nullish(),
    showInLeaderboard: z.boolean().optional(),
    preferredLanguage: z.nativeEnum(Language).optional(),
    preferredCategories: z.array(z.nativeEnum(Category)).optional(),
    demographics: demographicsSchema.optional(),
  })
  .strict();
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
