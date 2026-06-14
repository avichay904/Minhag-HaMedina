import { createZodDto } from 'nestjs-zod';
import {
  externalRegisterRequestSchema,
  externalRegisterResponseSchema,
  externalRespondentUpdateSchema,
  surveyResultsSchema,
} from '@mhm/contracts';

export class ExternalRegisterRequestDto extends createZodDto(externalRegisterRequestSchema) {}
export class ExternalRegisterResponseDto extends createZodDto(externalRegisterResponseSchema) {}
export class ExternalRespondentUpdateDto extends createZodDto(externalRespondentUpdateSchema) {}
export class SurveyResultsDto extends createZodDto(surveyResultsSchema) {}
