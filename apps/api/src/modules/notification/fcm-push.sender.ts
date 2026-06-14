import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'node:crypto';
import type { IPushSender, PushPayload } from './push-sender.interface';

/**
 * FCM push sender — uses the FCM HTTP v1 API via global fetch.
 *
 * Authentication flow:
 *  1. Build a service-account JWT (RS256) from the parsed service-account JSON.
 *  2. Exchange it at https://oauth2.googleapis.com/token for an OAuth2 access token.
 *  3. Cache the access token until 60 s before expiry.
 *  4. POST to https://fcm.googleapis.com/v1/projects/{projectId}/messages:send.
 *
 * Only active when FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT are both configured.
 * Falls back to logging on any error (never throws).
 */
@Injectable()
export class FcmPushSender implements IPushSender {
  private readonly logger = new Logger(FcmPushSender.name);
  private readonly projectId: string | undefined;
  private readonly serviceAccount: ServiceAccountJson | undefined;

  /** Cached OAuth2 access token + its wall-clock expiry timestamp (ms). */
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {
    this.projectId = this.config.get<string>('fcm.projectId') || undefined;

    const raw = this.config.get<string>('fcm.serviceAccount');
    if (raw) {
      try {
        this.serviceAccount = JSON.parse(raw) as ServiceAccountJson;
      } catch {
        this.logger.warn('[FcmPushSender] FCM_SERVICE_ACCOUNT is not valid JSON; FCM disabled.');
      }
    }
  }

  async send(token: string, payload: PushPayload): Promise<void> {
    if (!this.projectId || !this.serviceAccount) {
      this.logger.warn(
        '[FcmPushSender] FCM_PROJECT_ID or FCM_SERVICE_ACCOUNT not configured; skipping push.',
      );
      return;
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) return;

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
          Authorization: `Bearer ${accessToken}`,
        },
        body,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(`[FcmPushSender] FCM returned ${response.status}: ${text}`);
      }
    } catch (err) {
      this.logger.error('[FcmPushSender] fetch error sending message', err);
    }
  }

  // -------------------------------------------------------------------------
  // OAuth2 token management
  // -------------------------------------------------------------------------

  /**
   * Return a valid access token, refreshing from Google's token endpoint if
   * the cached one is absent or within 60 s of expiry.
   */
  private async getAccessToken(): Promise<string | null> {
    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiresAt - 60_000) {
      return this.cachedToken;
    }

    try {
      const jwt = this.buildServiceAccountJwt();
      const form = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      });

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(`[FcmPushSender] Token exchange failed ${res.status}: ${text}`);
        return null;
      }

      const data = (await res.json()) as { access_token: string; expires_in: number };
      this.cachedToken = data.access_token;
      // expires_in is in seconds; store absolute expiry as ms
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
      return this.cachedToken;
    } catch (err) {
      this.logger.error('[FcmPushSender] Failed to obtain OAuth2 access token', err);
      return null;
    }
  }

  /**
   * Build a self-signed service-account JWT for the
   * "urn:ietf:params:oauth:grant-type:jwt-bearer" grant.
   * Signed with RS256 using the service account private key (Node crypto).
   */
  private buildServiceAccountJwt(): string {
    const sa = this.serviceAccount!;
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour

    const header = base64urlEncode(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
    );
    const claimSet = base64urlEncode(
      JSON.stringify({
        iss: sa.client_email,
        sub: sa.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        iat: now,
        exp,
      }),
    );

    const signingInput = `${header}.${claimSet}`;

    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    const signature = signer
      .sign(sa.private_key, 'base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return `${signingInput}.${signature}`;
  }
}

// -------------------------------------------------------------------------
// Types + tiny helpers
// -------------------------------------------------------------------------

interface ServiceAccountJson {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

function base64urlEncode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
