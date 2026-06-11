import { createZodDto } from 'nestjs-zod';
import { anonymousLoginRequestSchema, socialLoginRequestSchema } from '@mhm/contracts';

export class SocialLoginDto extends createZodDto(socialLoginRequestSchema) {}
export class AnonymousLoginDto extends createZodDto(anonymousLoginRequestSchema) {}
