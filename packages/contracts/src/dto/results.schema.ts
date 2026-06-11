import { z } from 'zod';
import { CycleState, DisplayMode, QuestionType } from '@mhm/shared';

export const weightedResultSchema = z.object({
  weightedTotal: z.number(),
  weightedCount: z.number(),
  weightedResult: z.number().nullable(),
});

export const rawResultSchema = z.object({
  rawTotal: z.number(),
  rawCount: z.number(),
  rawAverage: z.number().nullable(),
});

export const distributionEntrySchema = z.object({
  key: z.string(),
  rawCount: z.number(),
  weightedCount: z.number(),
});

export const resultSummarySchema = z.object({
  questionId: z.string(),
  textHe: z.string(),
  textEn: z.string(),
  questionType: z.nativeEnum(QuestionType),
  totalResponses: z.number(),
  skippedCount: z.number(),
  skipRate: z.number(),
  displayMode: z.nativeEnum(DisplayMode),
  raw: rawResultSchema.optional(),
  weighted: weightedResultSchema.optional(),
  distribution: z.array(distributionEntrySchema).optional(),
});
export type ResultSummaryDto = z.infer<typeof resultSummarySchema>;

export const surveyResultsSchema = z.object({
  surveyId: z.string(),
  cycleId: z.string(),
  state: z.nativeEnum(CycleState),
  displayMode: z.nativeEnum(DisplayMode),
  totalRespondents: z.number(),
  questions: z.array(resultSummarySchema),
});
export type SurveyResults = z.infer<typeof surveyResultsSchema>;
