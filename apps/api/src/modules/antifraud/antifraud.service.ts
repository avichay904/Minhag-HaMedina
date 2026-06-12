import { Injectable } from '@nestjs/common';

import { type AntifraudInput, type AntifraudResult, type IAntifraudService } from '../../common/facades';

/** Minimum answer time in milliseconds below which we flag as suspiciously fast. */
const MIN_ANSWER_TIME_MS = 500;

/** Default IP velocity config: max 30 submissions within a 60-second window. */
export const DEFAULT_IP_VELOCITY_MAX = 30;
export const DEFAULT_IP_VELOCITY_WINDOW_MS = 60_000;

export interface IpVelocityConfig {
  maxPerWindow: number;
  windowMs: number;
}

/** Injectable clock so tests can control time deterministically. */
export type NowFn = () => number;

/**
 * Anomaly-flagging service (SRS §2.3 — flag, NEVER block or delete).
 *
 * Rules:
 *   1. answerTimeMs < 500 ms          → flagged as 'too_fast'
 *   2. IP exceeds velocity threshold   → flagged as 'ip_velocity'
 *
 * The constructor accepts optional config and clock overrides so unit tests
 * can inject deterministic values without real timers. NestJS registers it via
 * `AntifraudModule`; when NestJS constructs it no args are passed and defaults apply.
 *
 * Rate-limiting is handled globally by ThrottlerGuard; this service adds
 * lightweight behavioural anomaly detection that can be extended over time.
 */
@Injectable()
export class AntifraudService implements IAntifraudService {
  /**
   * In-memory sliding-window map: ip → sorted array of submission timestamps (ms).
   * Entries outside the window are pruned on each access to bound memory.
   */
  private readonly ipWindows = new Map<string, number[]>();

  private readonly ipMaxPerWindow: number;
  private readonly ipWindowMs: number;
  private readonly now: NowFn;

  constructor(
    ipVelocityConfig?: Partial<IpVelocityConfig>,
    now?: NowFn,
  ) {
    this.ipMaxPerWindow = ipVelocityConfig?.maxPerWindow ?? DEFAULT_IP_VELOCITY_MAX;
    this.ipWindowMs = ipVelocityConfig?.windowMs ?? DEFAULT_IP_VELOCITY_WINDOW_MS;
    this.now = now ?? (() => Date.now());
  }

  /**
   * Assess a submission for anomalies.
   *
   * Returns { flagged: false } when no anomaly is detected, or
   * { flagged: true, reason } when a rule fires.
   */
  async assess(input: AntifraudInput): Promise<AntifraudResult> {
    // Rule 1: answer too fast
    if (input.answerTimeMs != null && input.answerTimeMs < MIN_ANSWER_TIME_MS) {
      return { flagged: true, reason: 'too_fast' };
    }

    // Rule 2: IP velocity
    if (input.ip) {
      const ipFlagged = this.checkAndRecordIp(input.ip);
      if (ipFlagged) {
        return { flagged: true, reason: 'ip_velocity' };
      }
    }

    return { flagged: false };
  }

  /**
   * Records this IP's submission timestamp and checks whether it exceeds the
   * velocity threshold within the sliding window.
   *
   * @returns true if the threshold is exceeded (should be flagged).
   */
  private checkAndRecordIp(ip: string): boolean {
    const ts = this.now();
    const cutoff = ts - this.ipWindowMs;

    let timestamps = this.ipWindows.get(ip) ?? [];

    // Prune entries outside the window
    timestamps = timestamps.filter((t) => t > cutoff);

    // Record this submission
    timestamps.push(ts);
    this.ipWindows.set(ip, timestamps);

    // Flag if count within window exceeds threshold
    return timestamps.length > this.ipMaxPerWindow;
  }
}
