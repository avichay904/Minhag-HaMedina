import { NICKNAME_RULES } from '../constants.js';

export interface NicknameValidation {
  valid: boolean;
  reason?: 'too_short' | 'too_long' | 'invalid_chars';
}

/** Validate a public nickname: 3–20 chars, letters/digits/underscore only (SRS §5.4). */
export function validateNickname(nickname: string): NicknameValidation {
  if (nickname.length < NICKNAME_RULES.minLength) return { valid: false, reason: 'too_short' };
  if (nickname.length > NICKNAME_RULES.maxLength) return { valid: false, reason: 'too_long' };
  if (!NICKNAME_RULES.regex.test(nickname)) return { valid: false, reason: 'invalid_chars' };
  return { valid: true };
}

/** A nickname may only be changed once every 30 days (SRS §5.4). */
export function canChangeNickname(lastChangedAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastChangedAt) return true;
  const elapsedDays = (now.getTime() - lastChangedAt.getTime()) / (1000 * 60 * 60 * 24);
  return elapsedDays >= NICKNAME_RULES.changeIntervalDays;
}

/** Public display name: the nickname, or `User #<id>` fallback when opted-in without one. */
export function displayName(input: { nickname?: string | null; id: string | number }): string {
  return input.nickname && input.nickname.trim().length > 0
    ? input.nickname
    : `User #${input.id}`;
}
