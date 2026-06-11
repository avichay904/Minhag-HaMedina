import { z } from 'zod';
import { BadgeType, Rank } from '@mhm/shared';

export const leaderboardEntrySchema = z.object({
  position: z.number(),
  displayName: z.string(),
  rank: z.nativeEnum(Rank),
  badges: z.array(z.nativeEnum(BadgeType)),
  surveysCompleted: z.number(),
  points: z.number(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardResponseSchema = z.array(leaderboardEntrySchema);
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;
