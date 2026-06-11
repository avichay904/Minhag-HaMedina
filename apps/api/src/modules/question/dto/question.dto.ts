import { createZodDto } from 'nestjs-zod';
import { createQuestionRequestSchema } from '@mhm/contracts';

export class CreateQuestionDto extends createZodDto(createQuestionRequestSchema) {}
