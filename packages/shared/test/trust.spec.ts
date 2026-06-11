import { describe, expect, it } from 'vitest';
import { AuthProvider, resolveTrustScore } from '../src/index.js';

describe('resolveTrustScore', () => {
  it('maps each auth method to its base score (SRS §2.1)', () => {
    expect(resolveTrustScore({ authProvider: AuthProvider.GOOGLE })).toBe(1.0);
    expect(resolveTrustScore({ authProvider: AuthProvider.APPLE })).toBe(1.0);
    expect(resolveTrustScore({ authProvider: AuthProvider.EMAIL })).toBe(1.0);
    expect(resolveTrustScore({ authProvider: AuthProvider.FINGERPRINT })).toBe(0.7);
    expect(resolveTrustScore({ authProvider: AuthProvider.ANONYMOUS })).toBe(0.4);
    expect(resolveTrustScore({ authProvider: AuthProvider.IVR })).toBe(0.8);
    expect(resolveTrustScore({ authProvider: AuthProvider.EXTERNAL_UNIDENTIFIED })).toBe(0.6);
  });

  it('clamps external providers to the source registry range', () => {
    // Authorized external would be 1.0, but source caps at 0.7.
    expect(
      resolveTrustScore({
        authProvider: AuthProvider.EXTERNAL_AUTHORIZED,
        source: { trustScoreMin: 0.4, trustScoreMax: 0.7 },
      }),
    ).toBe(0.7);
    // Unknown external would be 0.4, source floor lifts it to 0.6.
    expect(
      resolveTrustScore({
        authProvider: AuthProvider.EXTERNAL_UNKNOWN,
        source: { trustScoreMin: 0.6, trustScoreMax: 1.0 },
      }),
    ).toBe(0.6);
  });

  it('does not clamp non-external providers by source range', () => {
    expect(
      resolveTrustScore({
        authProvider: AuthProvider.GOOGLE,
        source: { trustScoreMin: 0.4, trustScoreMax: 0.7 },
      }),
    ).toBe(1.0);
  });

  it('applies a behaviour modifier within global bounds', () => {
    expect(resolveTrustScore({ authProvider: AuthProvider.FINGERPRINT, behaviorModifier: -0.3 })).toBe(0.4);
    expect(resolveTrustScore({ authProvider: AuthProvider.GOOGLE, behaviorModifier: 0.5 })).toBe(1.0);
  });
});
