import { z } from 'zod';
import { Category, Gender, TargetGender, TargetLanguage } from '@mhm/shared';

export const demographicsSchema = z.object({
  age: z.number().int().min(0).max(120).nullish(),
  gender: z.nativeEnum(Gender).nullish(),
  region: z.string().max(120).nullish(),
});
export type DemographicsDto = z.infer<typeof demographicsSchema>;

export const targetingSchema = z.object({
  ageMin: z.number().int().min(0).max(120).nullish(),
  ageMax: z.number().int().min(0).max(120).nullish(),
  gender: z.nativeEnum(TargetGender).optional(),
  regions: z.array(z.string()).nullish(),
  language: z.nativeEnum(TargetLanguage).optional(),
  minTrustScore: z.number().min(0).max(1).optional(),
});
export type TargetingDto = z.infer<typeof targetingSchema>;

export const choiceOptionSchema = z.object({
  key: z.string().min(1),
  labelHe: z.string().min(1),
  labelEn: z.string().min(1),
});
export type ChoiceOptionDto = z.infer<typeof choiceOptionSchema>;

export const categorySchema = z.nativeEnum(Category);
