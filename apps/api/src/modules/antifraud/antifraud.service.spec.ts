import { beforeEach, describe, expect, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';

import { AntifraudService } from './antifraud.service';
import type { AntifraudInput } from '../../common/facades';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function buildService(): Promise<AntifraudService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [AntifraudService],
  }).compile();

  return module.get(AntifraudService);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AntifraudService.assess', () => {
  let service: AntifraudService;

  beforeEach(async () => {
    service = await buildService();
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
