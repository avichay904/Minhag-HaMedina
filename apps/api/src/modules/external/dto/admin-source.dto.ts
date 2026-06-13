import { createZodDto } from 'nestjs-zod';
import { createSourceRequestSchema, updateSourceRequestSchema } from '@mhm/contracts';

export class CreateSourceDto extends createZodDto(createSourceRequestSchema) {}
export class UpdateSourceDto extends createZodDto(updateSourceRequestSchema) {}
