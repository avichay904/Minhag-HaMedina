import { Injectable, Logger } from '@nestjs/common';
import type { IPushSender, PushPayload } from './push-sender.interface';

/**
 * Default (no-FCM) push sender — simply logs the notification.
 * Used in all non-FCM environments (dev, test, CI).
 */
@Injectable()
export class LogPushSender implements IPushSender {
  private readonly logger = new Logger(LogPushSender.name);

  async send(token: string, payload: PushPayload): Promise<void> {
    this.logger.log(
      `[LogPushSender] Would send push to token=${token.slice(0, 8)}… title="${payload.title}" body="${payload.body}"`,
    );
  }
}
