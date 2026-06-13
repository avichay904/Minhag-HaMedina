import { z } from 'zod';
import { AuthProvider, Language } from '@mhm/shared';
import { demographicsSchema } from './common.schema.js';
import { respondentProfileSchema } from './respondent.schema.js';

export const socialLoginRequestSchema = z.object({
  provider: z.enum([AuthProvider.GOOGLE, AuthProvider.APPLE]),
  /** OAuth identity token (or a signed dev token when IDENTITY_MODE=dev). */
  token: z.string().min(1),
  preferredLanguage: z.nativeEnum(Language).optional(),
});
export type SocialLoginRequest = z.infer<typeof socialLoginRequestSchema>;

export const anonymousLoginRequestSchema = z.object({
  fingerprint: z.string().min(8).optional(),
  preferredLanguage: z.nativeEnum(Language).optional(),
  /** Proof-of-Work challenge string issued by GET /auth/pow-challenge (optional unless POW_ENABLED=true). */
  powChallenge: z.string().optional(),
  /** Client nonce that satisfies the PoW difficulty requirement. */
  powNonce: z.string().optional(),
});
export type AnonymousLoginRequest = z.infer<typeof anonymousLoginRequestSchema>;

export const authResponseSchema = z.object({
  token: z.string(),
  respondent: respondentProfileSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const externalRegisterRequestSchema = z.object({
  externalId: z.string().optional(),
  demographics: demographicsSchema.optional(),
  preferredLanguage: z.nativeEnum(Language).optional(),
});
export type ExternalRegisterRequest = z.infer<typeof externalRegisterRequestSchema>;

export const externalRegisterResponseSchema = z.object({
  respondentId: z.string(),
  token: z.string(),
});
export type ExternalRegisterResponse = z.infer<typeof externalRegisterResponseSchema>;

export const externalRespondentUpdateSchema = z.object({
  externalId: z.string().optional(),
  demographics: demographicsSchema.optional(),
  preferredLanguage: z.nativeEnum(Language).optional(),
});
export type ExternalRespondentUpdate = z.infer<typeof externalRespondentUpdateSchema>;
