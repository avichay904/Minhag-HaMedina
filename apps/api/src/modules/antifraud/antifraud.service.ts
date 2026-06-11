import { Injectable } from '@nestjs/common';

import { type AntifraudInput, type AntifraudResult, type IAntifraudService } from '../../common/facades';

/** Minimum answer time in milliseconds below which we flag as suspiciously fast. */
const MIN_ANSWER_TIME_MS = 500;

/**
 * Anomaly-flagging service (SRS §2.3 — flag, NEVER block or delete).
 *
 * Current rules:
 *   1. answerTimeMs < 500 ms → flagged as 'too_fast'
 *
 * Rate-limiting is handled globally by ThrottlerGuard; this service adds
 * lightweight behavioural anomaly detection that can be extended over time.
 */
@Injectable()
export class AntifraudService implements IAntifraudService {
  /**
   * Assess a submission for anomalies.
   *
   * Returns { flagged: false } when no anomaly is detected, or
   * { flagged: true, reason } when a rule fires.
   */
  async assess(input: AntifraudInput): Promise<AntifraudResult> {
    if (input.answerTimeMs != null && input.answerTimeMs < MIN_ANSWER_TIME_MS) {
      return { flagged: true, reason: 'too_fast' };
    }

    return { flagged: false };
  }
}
