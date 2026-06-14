import { z } from 'zod';

/**
 * Admin Source Registry DTOs.
 * Note: apiKeyHash is NEVER exposed — only the raw key is returned once on creation.
 */

export const sourceDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  trustScoreMin: z.number(),
  trustScoreMax: z.number(),
  canRegisterUsers: z.boolean(),
  canReadResults: z.boolean(),
  resultsScope: z.unknown().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
});
export type SourceDto = z.infer<typeof sourceDtoSchema>;

export const sourceListResponseSchema = z.array(sourceDtoSchema);
export type SourceListResponse = z.infer<typeof sourceListResponseSchema>;

/** trustScoreMin must not exceed trustScoreMax (inverted range silently clamps all trust to the min). */
const trustRangeOk = (s: { trustScoreMin?: number; trustScoreMax?: number }): boolean =>
  s.trustScoreMin == null || s.trustScoreMax == null || s.trustScoreMin <= s.trustScoreMax;

/** POST /sources — create a new external source */
export const createSourceRequestSchema = z
  .object({
    name: z.string().min(1),
    trustScoreMin: z.number().min(0).max(1).optional(),
    trustScoreMax: z.number().min(0).max(1).optional(),
    canRegisterUsers: z.boolean().optional(),
    canReadResults: z.boolean().optional(),
    resultsScope: z
      .object({
        ownRespondentsOnly: z.boolean(),
        categories: z.array(z.string()),
      })
      .optional(),
    active: z.boolean().optional(),
  })
  .refine(trustRangeOk, { message: 'trustScoreMin must be ≤ trustScoreMax', path: ['trustScoreMax'] });
export type CreateSourceRequest = z.infer<typeof createSourceRequestSchema>;

/** Response for POST /sources: includes the source row PLUS the raw apiKey (shown once). */
export const createSourceResponseSchema = sourceDtoSchema.extend({
  apiKey: z.string(),
});
export type CreateSourceResponse = z.infer<typeof createSourceResponseSchema>;

/** PATCH /sources/:id — partial update */
export const updateSourceRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    trustScoreMin: z.number().min(0).max(1).optional(),
    trustScoreMax: z.number().min(0).max(1).optional(),
    canRegisterUsers: z.boolean().optional(),
    canReadResults: z.boolean().optional(),
    resultsScope: z
      .object({
        ownRespondentsOnly: z.boolean(),
        categories: z.array(z.string()),
      })
      .nullish(),
    active: z.boolean().optional(),
  })
  .refine(trustRangeOk, { message: 'trustScoreMin must be ≤ trustScoreMax', path: ['trustScoreMax'] });
export type UpdateSourceRequest = z.infer<typeof updateSourceRequestSchema>;
