import { beforeEach, describe, expect, it } from 'vitest';

import { AntifraudService } from './antifraud.service';
import type { AntifraudInput } from '../../common/facades';

// ---------------------------------------------------------------------------
// Helper — builds a fresh service instance with optional config overrides.
// Bypasses NestJS DI so we can control constructor args directly.
// ---------------------------------------------------------------------------

function buildService(
  ipVelocityConfig?: { maxPerWindow?: number; windowMs?: number },
  now?: () => number,
): AntifraudService {
  return new AntifraudService(ipVelocityConfig, now);
}

// ---------------------------------------------------------------------------
// Tests: existing too_fast rule
// ---------------------------------------------------------------------------

describe('AntifraudService.assess — too_fast rule', () => {
  let service: AntifraudService;

  beforeEach(() => {
    service = buildService();
  });

  it('returns flagged:false when no answerTimeMs is provided', async () => {
    const input: AntifraudInput = { respondentId: 'r1' };
    const result = await service.assess(input);

    expect(result.flagged).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('returns flagged:false when answerTimeMs is exactly 500 ms', async () => {
    const result = await service.assess({ answerTimeMs: 500 });
    expect(result.flagged).toBe(false);
  });

  it('returns flagged:false when answerTimeMs is above the threshold', async () => {
    const result = await service.assess({ answerTimeMs: 1200 });
    expect(result.flagged).toBe(false);
  });

  it('flags as too_fast when answerTimeMs is 499 ms (one below threshold)', async () => {
    const result = await service.assess({ answerTimeMs: 499 });

    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('too_fast');
  });

  it('flags as too_fast when answerTimeMs is 0', async () => {
    const result = await service.assess({ answerTimeMs: 0 });

    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('too_fast');
  });

  it('flags as too_fast even when other fields are present', async () => {
    const input: AntifraudInput = {
      respondentId: 'r-xyz',
      fingerprintHash: 'abc',
      ip: '127.0.0.1',
      answerTimeMs: 100,
    };
    const result = await service.assess(input);

    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('too_fast');
  });

  it('returns flagged:false when answerTimeMs is null-like (undefined)', async () => {
    // answerTimeMs explicitly undefined should not trigger the rule.
    const result = await service.assess({ respondentId: 'r1', answerTimeMs: undefined });
    expect(result.flagged).toBe(false);
  });

  it('returns an object with only flagged:false and no extra keys when clean', async () => {
    const result = await service.assess({});
    expect(result.flagged).toBe(false);
    // reason should be absent (undefined), not a truthy string
    expect(result.reason).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: IP velocity rule
// ---------------------------------------------------------------------------

describe('AntifraudService.assess — ip_velocity rule', () => {
  const IP = '1.2.3.4';
  const OTHER_IP = '9.9.9.9';

  it('does not flag when ip is absent', async () => {
    // Service with a threshold of 2 per 60 s — but no ip provided.
    const service = buildService({ maxPerWindow: 2, windowMs: 60_000 });
    const result = await service.assess({ respondentId: 'r1' });
    expect(result.flagged).toBe(false);
  });

  it('does not flag when submissions are under the threshold', async () => {
    // Threshold = 3; send exactly 3 — should NOT flag (we flag on strictly greater).
    const service = buildService({ maxPerWindow: 3, windowMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      const result = await service.assess({ ip: IP });
      expect(result.flagged).toBe(false);
    }
  });

  it('flags ip_velocity when submissions exceed the threshold within the window', async () => {
    // Threshold = 3; 4th submission should be flagged.
    const service = buildService({ maxPerWindow: 3, windowMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      await service.assess({ ip: IP });
    }
    const result = await service.assess({ ip: IP });

    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('ip_velocity');
  });

  it('counts submissions per IP independently — different IPs do not affect each other', async () => {
    // Threshold = 2; fill up IP to the limit, OTHER_IP should still be clean.
    const service = buildService({ maxPerWindow: 2, windowMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      await service.assess({ ip: IP });
    }

    // OTHER_IP has only 1 submission — should not be flagged.
    const result = await service.assess({ ip: OTHER_IP });
    expect(result.flagged).toBe(false);
  });

  it('sliding window: old submissions age out and the IP is no longer flagged', async () => {
    // Fake clock that we advance manually.
    let fakeNow = 0;
    const service = buildService(
      { maxPerWindow: 2, windowMs: 1_000 },
      () => fakeNow,
    );

    // Fill window: 3 submissions at t=0 (exceeds threshold of 2).
    for (let i = 0; i < 3; i++) {
      await service.assess({ ip: IP });
    }

    // Advance time past the window.
    fakeNow = 1_001;

    // A new submission at t=1001 — the 3 old ones are outside the 1 s window,
    // so the count resets to 1 (just this new one). Should NOT be flagged.
    const result = await service.assess({ ip: IP });
    expect(result.flagged).toBe(false);
  });

  it('too_fast takes priority over ip_velocity when both rules fire', async () => {
    const service = buildService({ maxPerWindow: 0, windowMs: 60_000 });

    // The very first submission would exceed threshold=0.
    const result = await service.assess({ ip: IP, answerTimeMs: 100 });

    // too_fast fires first in the code, so reason should be 'too_fast'.
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('too_fast');
  });
});
