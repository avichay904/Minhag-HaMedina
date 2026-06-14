/** Payload for a push notification message. */
export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Abstraction over the actual push delivery channel. */
export interface IPushSender {
  /**
   * Send a push notification to the given device token.
   * Implementations must never throw — silently log and return on failure.
   */
  send(token: string, payload: PushPayload): Promise<void>;
}

export const PUSH_SENDER = 'PUSH_SENDER';
