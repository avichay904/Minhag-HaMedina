import { z } from 'zod';

/** Response body for GET /auth/pow-challenge */
export const powChallengeResponseSchema = z.object({
  challenge: z.string(),
  difficulty: z.number().int().positive(),
  expiresAt: z.string().datetime(),
});
export type PowChallengeResponse = z.infer<typeof powChallengeResponseSchema>;
