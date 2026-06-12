import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IPushSender, PushPayload } from './push-sender.interface';

/**
 * FCM push sender — uses the FCM HTTP v1 API via global fetch.
 * Only instantiated when FCM_PROJECT_ID is set in the environment.
 * Falls back to logging on any error (never throws).
 */
@Injectable()
export class FcmPushSender implements IPushSender {
  private readonly logger = new Logger(FcmPushSender.name);
  private readonly serverKey: string;
  private readonly projectId: string;

  constructor(private readonly config: ConfigService) {
    this.serverKey = this.config.get<string>('fcm.serverKey') ?? '';
    this.projectId = this.config.get<string>('fcm.projectId') ?? '';
  }

  async send(token: string, payload: PushPayload): Promise<void> {
    if (!this.serverKey || !this.projectId) {
      this.logger.warn('[FcmPushSender] FCM_SERVER_KEY or FCM_PROJECT_ID not configured; skipping push.');
      return;
    }

    const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;
    const body = JSON.stringify({
      message: {
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
      },
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.serverKey}`,
        },
        body,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(`[FcmPushSender] FCM returned ${response.status}: ${text}`);
      }
    } catch (err) {
      this.logger.error('[FcmPushSender] fetch error', err);
    }
  }
}
