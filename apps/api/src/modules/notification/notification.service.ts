import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PUSH_SENDER, type IPushSender, type PushPayload } from './push-sender.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_SENDER) private readonly sender: IPushSender,
  ) {}

  /**
   * Send a push notification to a respondent.
   * Looks up their notificationToken from the database.
   * No-ops silently if the respondent has no token.
   */
  async notifyRespondent(respondentId: string, payload: PushPayload): Promise<void> {
    const respondent = await this.prisma.respondent.findUnique({
      where: { id: respondentId },
      select: { notificationToken: true },
    });

    if (!respondent?.notificationToken) {
      this.logger.debug(`[NotificationService] No token for respondent ${respondentId}; skipping push.`);
      return;
    }

    await this.sender.send(respondent.notificationToken, payload);
  }
}
