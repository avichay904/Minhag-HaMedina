import { describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';

import { NotificationService } from './notification.service';
import { PUSH_SENDER, type IPushSender, type PushPayload } from './push-sender.interface';
import { PrismaService } from '../../common/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSender(): IPushSender & { send: ReturnType<typeof vi.fn> } {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

function makeMockPrisma(notificationToken: string | null) {
  return {
    respondent: {
      findUnique: vi.fn().mockResolvedValue(
        notificationToken !== null ? { notificationToken } : null,
      ),
    },
  };
}

async function buildService(
  notificationToken: string | null,
): Promise<{ service: NotificationService; sender: IPushSender & { send: ReturnType<typeof vi.fn> } }> {
  const sender = makeMockSender();
  const prisma = makeMockPrisma(notificationToken);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NotificationService,
      { provide: PUSH_SENDER, useValue: sender },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();

  return { service: module.get(NotificationService), sender };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationService.notifyRespondent', () => {
  const RESPONDENT_ID = 'r-abc-123';
  const TOKEN = 'fcm-device-token-xyz';
  const PAYLOAD: PushPayload = { title: 'Hello', body: 'World' };

  it('calls sender.send once when the respondent has a notification token', async () => {
    const { service, sender } = await buildService(TOKEN);

    await service.notifyRespondent(RESPONDENT_ID, PAYLOAD);

    expect(sender.send).toHaveBeenCalledOnce();
    expect(sender.send).toHaveBeenCalledWith(TOKEN, PAYLOAD);
  });

  it('does NOT call sender.send when the respondent has no token (null)', async () => {
    const { service, sender } = await buildService(null);

    await service.notifyRespondent(RESPONDENT_ID, PAYLOAD);

    expect(sender.send).not.toHaveBeenCalled();
  });

  it('does NOT call sender.send when the respondent record is missing entirely', async () => {
    // makeMockPrisma(null) returns null for the record → same code path
    const { service, sender } = await buildService(null);

    await service.notifyRespondent('nonexistent-id', PAYLOAD);

    expect(sender.send).not.toHaveBeenCalled();
  });
});
