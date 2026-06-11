import { z } from 'zod';
import { Category, QuestionType } from '@mhm/shared';
import { choiceOptionSchema, targetingSchema } from './common.schema.js';

/** Public-facing question (both languages sent; client localises). */
export const questionDtoSchema = z.object({
  id: z.string(),
  surveyId: z.string(),
  category: z.nativeEnum(Category),
  type: z.nativeEnum(QuestionType),
  textHe: z.string(),
  textEn: z.string(),
  scaleMin: z.number().int().nullable().optional(),
  scaleMax: z.number().int().nullable().optional(),
  options: z.array(choiceOptionSchema).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});
export type QuestionDto = z.infer<typeof questionDtoSchema>;

export const questionsResponseSchema = z.array(questionDtoSchema);
export type QuestionsResponse = z.infer<typeof questionsResponseSchema>;

export const createQuestionRequestSchema = z
  .object({
    surveyId: z.string().uuid(),
    category: z.nativeEnum(Category),
    textHe: z.string().min(1),
    textEn: z.string().min(1),
    type: z.nativeEnum(QuestionType),
    scaleMin: z.number().int().optional(),
    scaleMax: z.number().int().optional(),
    options: z.array(choiceOptionSchema).min(2).max(8).optional(),
    imageUrl: z.string().url().nullish(),
    expiresAfterCycles: z.number().int().positive().nullish(),
    targeting: targetingSchema.optional(),
  })
  .refine((q) => q.type !== QuestionType.SCALE || (q.scaleMin != null && q.scaleMax != null), {
    message: 'scaleMin and scaleMax are required for scale questions',
    path: ['scaleMin'],
  })
  .refine((q) => q.type !== QuestionType.SINGLE_CHOICE || (q.options != null && q.options.length >= 2), {
    message: 'single_choice questions require at least 2 options',
    path: ['options'],
  });
export type CreateQuestionRequest = z.infer<typeof createQuestionRequestSchema>;
