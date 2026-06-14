import { createZodDto } from 'nestjs-zod';
import { createQuestionRequestSchema, listQuestionsQuerySchema } from '@mhm/contracts';

export class CreateQuestionDto extends createZodDto(createQuestionRequestSchema) {}
export class ListQuestionsQueryDto extends createZodDto(listQuestionsQuerySchema) {}
