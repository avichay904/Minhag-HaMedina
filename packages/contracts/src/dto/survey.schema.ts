import { z } from 'zod';
import { Cadence, CycleState } from '@mhm/shared';

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
