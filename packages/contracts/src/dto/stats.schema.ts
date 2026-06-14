import { z } from 'zod';

export const communityStatsResponseSchema = z.object({
  answeredToday: z.number().int().nonnegative(),
  respondentsToday: z.number().int().nonnegative(),
});

export type CommunityStatsResponse = z.infer<typeof communityStatsResponseSchema>;
