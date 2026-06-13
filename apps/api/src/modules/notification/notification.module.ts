import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { LogPushSender } from './log-push.sender';
import { FcmPushSender } from './fcm-push.sender';
import { PUSH_SENDER } from './push-sender.interface';

/**
 * NotificationModule — env-gated push notification delivery.
 *
 * FCM HTTP v1 is used when BOTH FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT are set.
 * Otherwise the LogPushSender is used (safe default for dev/test/CI).
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
        const fcmServiceAccount = config.get<string>('fcm.serviceAccount');
        return fcmProjectId && fcmServiceAccount ? fcmSender : logSender;
      },
    },
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
