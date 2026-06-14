import { afterEach, describe, expect, it, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { FcmPushSender } from './fcm-push.sender';
import type { PushPayload } from './push-sender.interface';

// ---------------------------------------------------------------------------
// Minimal RSA-like private key (for unit tests only — NOT a real key).
// We use a real Node-crypto-generated RSA keypair so createSign doesn't fail.
// ---------------------------------------------------------------------------

import { generateKeyPairSync } from 'node:crypto';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

const FAKE_SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'key-id-1',
  private_key: PRIVATE_KEY_PEM,
  client_email: 'test@test-project.iam.gserviceaccount.com',
  client_id: '123456',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
};

const FAKE_PROJECT_ID = 'test-project';

const PAYLOAD: PushPayload = { title: 'Test', body: 'Hello world', data: { key: 'val' } };
const DEVICE_TOKEN = 'device-token-abc';

// ---------------------------------------------------------------------------
// Helper — build FcmPushSender with optional config
// ---------------------------------------------------------------------------

async function buildSender(opts: {
  projectId?: string;
  serviceAccount?: object | null;
}): Promise<FcmPushSender> {
  const { projectId, serviceAccount } = opts;

  const configMock = {
    get: vi.fn((key: string) => {
      if (key === 'fcm.projectId') return projectId ?? undefined;
      if (key === 'fcm.serviceAccount')
        return serviceAccount !== null && serviceAccount !== undefined
          ? JSON.stringify(serviceAccount)
          : undefined;
      return undefined;
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [FcmPushSender, { provide: ConfigService, useValue: configMock }],
  }).compile();

  return module.get(FcmPushSender);
}

// ---------------------------------------------------------------------------
// Helper — mock global fetch
// ---------------------------------------------------------------------------

function mockFetch(
  tokenResponse: object,
  sendResponse: { ok: boolean; status: number; text?: string } = { ok: true, status: 200 },
) {
  let callCount = 0;
  const fetchSpy = vi.fn(async (_url: string, _opts?: RequestInit) => {
    callCount++;
    if (callCount === 1) {
      // First call: token exchange
      return {
        ok: true,
        status: 200,
        json: async () => tokenResponse,
        text: async () => JSON.stringify(tokenResponse),
      } as unknown as Response;
    }
    // Second call: FCM send
    return {
      ok: sendResponse.ok,
      status: sendResponse.status,
      text: async () => sendResponse.text ?? '',
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

// ---------------------------------------------------------------------------
// Tests: sender not configured
// ---------------------------------------------------------------------------

describe('FcmPushSender — not configured', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does NOT call fetch when projectId is absent', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const sender = await buildSender({ serviceAccount: FAKE_SERVICE_ACCOUNT });
    await sender.send(DEVICE_TOKEN, PAYLOAD);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does NOT call fetch when serviceAccount is absent', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const sender = await buildSender({ projectId: FAKE_PROJECT_ID, serviceAccount: null });
    await sender.send(DEVICE_TOKEN, PAYLOAD);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does NOT call fetch when both are absent', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const sender = await buildSender({});
    await sender.send(DEVICE_TOKEN, PAYLOAD);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: token exchange
// ---------------------------------------------------------------------------

describe('FcmPushSender — token exchange', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls OAuth2 token endpoint first with grant_type=jwt-bearer', async () => {
    const fetchSpy = mockFetch({ access_token: 'tok-abc', expires_in: 3600 });

    const sender = await buildSender({
      projectId: FAKE_PROJECT_ID,
      serviceAccount: FAKE_SERVICE_ACCOUNT,
    });
    await sender.send(DEVICE_TOKEN, PAYLOAD);

    // First fetch must be the token endpoint
    const firstCall = fetchSpy.mock.calls[0];
    expect(firstCall[0]).toBe('https://oauth2.googleapis.com/token');
    const body = (firstCall[1] as RequestInit).body as string;
    expect(body).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
  });

  it('sends FCM message with Bearer token from token exchange', async () => {
    const ACCESS_TOKEN = 'access-token-xyz';
    const fetchSpy = mockFetch({ access_token: ACCESS_TOKEN, expires_in: 3600 });

    const sender = await buildSender({
      projectId: FAKE_PROJECT_ID,
      serviceAccount: FAKE_SERVICE_ACCOUNT,
    });
    await sender.send(DEVICE_TOKEN, PAYLOAD);

    // Second fetch must be the FCM send endpoint
    const secondCall = fetchSpy.mock.calls[1];
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${FAKE_PROJECT_ID}/messages:send`;
    expect(secondCall[0]).toBe(fcmUrl);
    const headers = (secondCall[1] as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it('caches the access token and reuses it on subsequent sends', async () => {
    const fetchSpy = mockFetch({ access_token: 'cached-token', expires_in: 3600 });

    const sender = await buildSender({
      projectId: FAKE_PROJECT_ID,
      serviceAccount: FAKE_SERVICE_ACCOUNT,
    });

    await sender.send(DEVICE_TOKEN, PAYLOAD);
    await sender.send(DEVICE_TOKEN, PAYLOAD);

    // Token fetch (1) + send (1) + send (1) = 3 total, NOT 4 (no second token fetch)
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('re-fetches token when cached token is near expiry', async () => {
    const fetchSpy = mockFetch({ access_token: 'new-token', expires_in: 3600 });

    const sender = await buildSender({
      projectId: FAKE_PROJECT_ID,
      serviceAccount: FAKE_SERVICE_ACCOUNT,
    });

    // Force token to be expired by injecting state
    (sender as unknown as { tokenExpiresAt: number }).tokenExpiresAt = Date.now() - 1;
    (sender as unknown as { cachedToken: string | null }).cachedToken = 'old-token';

    await sender.send(DEVICE_TOKEN, PAYLOAD);

    // Should re-fetch token: token fetch (1) + send (1) = 2
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const authHeader = (fetchSpy.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(authHeader['Authorization']).toBe('Bearer new-token');
  });

  it('does not call FCM send when token exchange fails', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchSpy);

    const sender = await buildSender({
      projectId: FAKE_PROJECT_ID,
      serviceAccount: FAKE_SERVICE_ACCOUNT,
    });
    await sender.send(DEVICE_TOKEN, PAYLOAD);

    // Only the token endpoint was called; FCM endpoint was NOT called
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
  });
});

// ---------------------------------------------------------------------------
// Tests: FCM send — request shape
// ---------------------------------------------------------------------------

describe('FcmPushSender — FCM send request', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends correct notification payload to FCM', async () => {
    const fetchSpy = mockFetch({ access_token: 'token', expires_in: 3600 });

    const sender = await buildSender({
      projectId: FAKE_PROJECT_ID,
      serviceAccount: FAKE_SERVICE_ACCOUNT,
    });
    await sender.send(DEVICE_TOKEN, PAYLOAD);

    const sendCall = fetchSpy.mock.calls[1];
    const body = JSON.parse((sendCall[1] as RequestInit).body as string);

    expect(body.message.token).toBe(DEVICE_TOKEN);
    expect(body.message.notification.title).toBe(PAYLOAD.title);
    expect(body.message.notification.body).toBe(PAYLOAD.body);
    expect(body.message.data).toEqual(PAYLOAD.data);
  });

  it('does not throw when FCM returns a non-OK status (logs warning instead)', async () => {
    mockFetch({ access_token: 'token', expires_in: 3600 }, { ok: false, status: 400, text: 'Bad Request' });

    const sender = await buildSender({
      projectId: FAKE_PROJECT_ID,
      serviceAccount: FAKE_SERVICE_ACCOUNT,
    });

    // Must not throw
    await expect(sender.send(DEVICE_TOKEN, PAYLOAD)).resolves.toBeUndefined();
  });

  it('does not throw when fetch throws a network error', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) } as unknown as Response;
      }
      throw new Error('Network error');
    }));

    const sender = await buildSender({
      projectId: FAKE_PROJECT_ID,
      serviceAccount: FAKE_SERVICE_ACCOUNT,
    });

    await expect(sender.send(DEVICE_TOKEN, PAYLOAD)).resolves.toBeUndefined();
  });
});
