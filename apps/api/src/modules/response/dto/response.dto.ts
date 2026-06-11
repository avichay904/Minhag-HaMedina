import { createZodDto } from 'nestjs-zod';
import { submitResponseRequestSchema, skipRequestSchema } from '@mhm/contracts';

/** Body DTO for POST /responses */
export class SubmitResponseDto extends createZodDto(submitResponseRequestSchema) {}

/** Body DTO for POST /responses/skip */
export class SkipDto extends createZodDto(skipRequestSchema) {}
