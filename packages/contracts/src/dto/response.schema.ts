import { z } from 'zod';
import { BadgeType } from '@mhm/shared';

export const submitResponseRequestSchema = z.object({
  questionId: z.string().uuid(),
  answerValue: z.union([z.string(), z.number()]),
  /** Time taken to answer, ms — feeds the "fast" badge. */
  answerTimeMs: z.number().int().nonnegative().optional(),
  /** Required for anonymous principals so the never-repeat guard can key on it. */
  fingerprint: z.string().min(8).optional(),
});
export type SubmitResponseRequest = z.infer<typeof submitResponseRequestSchema>;

export const skipRequestSchema = z.object({
  questionId: z.string().uuid(),
  fingerprint: z.string().min(8).optional(),
});
export type SkipRequest = z.infer<typeof skipRequestSchema>;

export const challengeProgressDtoSchema = z.object({
  target: z.number(),
  countAnswered: z.number(),
  countSeen: z.number(),
  completed: z.boolean(),
});
export type ChallengeProgressDto = z.infer<typeof challengeProgressDtoSchema>;

export const submitResponseResponseSchema = z.object({
  accepted: z.boolean(),
  pointsEarned: z.number(),
  newBadges: z.array(z.nativeEnum(BadgeType)),
  challengeProgress: challengeProgressDtoSchema.nullable(),
});
export type SubmitResponseResponse = z.infer<typeof submitResponseResponseSchema>;

export const answeredEntrySchema = z.object({
  questionId: z.string(),
  skipped: z.boolean(),
  answeredAt: z.string(),
});
export const answeredResponseSchema = z.array(answeredEntrySchema);
export type AnsweredResponse = z.infer<typeof answeredResponseSchema>;
