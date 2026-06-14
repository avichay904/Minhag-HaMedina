import { createZodDto } from 'nestjs-zod';
import { createSurveyRequestSchema } from '@mhm/contracts';

export class CreateSurveyDto extends createZodDto(createSurveyRequestSchema) {}
