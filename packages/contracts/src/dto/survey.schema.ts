import { z } from 'zod';
import { Cadence, CycleState, DisplayMode } from '@mhm/shared';

export const cycleSummarySchema = z.object({
  id: z.string(),
  state: z.nativeEnum(CycleState),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
});
export type CycleSummary = z.infer<typeof cycleSummarySchema>;

export const surveyDtoSchema = z.object({
  id: z.string(),
  titleHe: z.string(),
  titleEn: z.string(),
  cadence: z.nativeEnum(Cadence),
  activeCycle: cycleSummarySchema.nullable(),
  questionCount: z.number(),
});
export type SurveyDto = z.infer<typeof surveyDtoSchema>;

export const activeSurveysResponseSchema = z.array(surveyDtoSchema);
export type ActiveSurveysResponse = z.infer<typeof activeSurveysResponseSchema>;

// ---------------------------------------------------------------------------
// Admin-only schemas
// ---------------------------------------------------------------------------

/** POST /surveys — create a new survey */
export const createSurveyRequestSchema = z.object({
  titleHe: z.string().min(1),
  titleEn: z.string().min(1),
  cadence: z.nativeEnum(Cadence).optional(),
});
export type CreateSurveyRequest = z.infer<typeof createSurveyRequestSchema>;

/** Full cycle row returned in admin survey list */
export const adminCycleRowSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  state: z.nativeEnum(CycleState),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  displayMode: z.nativeEnum(DisplayMode),
});
export type AdminCycleRow = z.infer<typeof adminCycleRowSchema>;

/** GET /surveys — admin survey list item */
export const adminSurveyDtoSchema = z.object({
  id: z.string(),
  titleHe: z.string(),
  titleEn: z.string(),
  cadence: z.nativeEnum(Cadence),
  active: z.boolean(),
  questionCount: z.number(),
  cycles: z.array(adminCycleRowSchema),
});
export type AdminSurveyDto = z.infer<typeof adminSurveyDtoSchema>;

export const adminSurveysResponseSchema = z.array(adminSurveyDtoSchema);
export type AdminSurveysResponse = z.infer<typeof adminSurveysResponseSchema>;
