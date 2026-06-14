import { createZodDto } from 'nestjs-zod';
import { updateProfileRequestSchema } from '@mhm/contracts';

export class UpdateProfileDto extends createZodDto(updateProfileRequestSchema) {}
