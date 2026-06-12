import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { LogPushSender } from './log-push.sender';
import { FcmPushSender } from './fcm-push.sender';
import { PUSH_SENDER } from './push-sender.interface';

/**
 * NotificationModule — env-gated push notification delivery.
 *
 * If FCM_PROJECT_ID is set, uses FcmPushSender; otherwise falls back to
 * LogPushSender (safe default for dev/test/CI).
 */
@Module({
  providers: [
    LogPushSender,
    FcmPushSender,
    {
      provide: PUSH_SENDER,
      inject: [ConfigService, LogPushSender, FcmPushSender],
      useFactory: (
        config: ConfigService,
        logSender: LogPushSender,
        fcmSender: FcmPushSender,
      ) => {
        const fcmProjectId = config.get<string>('fcm.projectId');
        return fcmProjectId ? fcmSender : logSender;
      },
    },
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
