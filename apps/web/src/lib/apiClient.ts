import { ENDPOINTS, buildPath } from '@mhm/contracts';
import type {
  AuthResponse,
  SocialLoginRequest,
  AnonymousLoginRequest,
  RespondentProfile,
  ActiveSurveysResponse,
  QuestionsResponse,
  SubmitResponseRequest,
  SubmitResponseResponse,
  SkipRequest,
  AnsweredResponse,
  UpdateProfileRequest,
  SurveyResults,
  LeaderboardResponse,
  CommunityStatsResponse,
  ApiError,
} from '@mhm/contracts';

// ─── Token store ────────────────────────────────────────────────────────────
const TOKEN_KEY = 'mhm_jwt';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Base URL ────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1') as string;

// Strip trailing slash and /api/v1 suffix if present so we can prepend cleanly
function resolveUrl(path: string): string {
  // BASE_URL already includes /api/v1 per env convention
  const base = BASE_URL.replace(/\/+$/, '');
  return `${base}${path}`;
}

// ─── Typed error ─────────────────────────────────────────────────────────────
export class ApiRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly body: ApiError,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Source': 'web',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(resolveUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errorBody: ApiError;
    try {
      errorBody = (await res.json()) as ApiError;
    } catch {
      errorBody = {
        statusCode: res.status,
        message: res.statusText,
      };
    }
    const msg = Array.isArray(errorBody.message)
      ? errorBody.message.join(', ')
      : errorBody.message;
    throw new ApiRequestError(res.status, msg, errorBody);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ─── Typed API methods ────────────────────────────────────────────────────────
export const api = {
  // Auth
  socialLogin(body: SocialLoginRequest): Promise<AuthResponse> {
    return request('POST', ENDPOINTS.socialLogin.path, body);
  },
  anonymousLogin(body: AnonymousLoginRequest = {}): Promise<AuthResponse> {
    return request('POST', ENDPOINTS.anonymousLogin.path, body);
  },

  // Surveys
  activeSurveys(): Promise<ActiveSurveysResponse> {
    return request('GET', ENDPOINTS.activeSurveys.path);
  },
  surveyQuestions(surveyId: string): Promise<QuestionsResponse> {
    const path = buildPath(ENDPOINTS.surveyQuestions.path, { id: surveyId });
    return request('GET', path);
  },

  // Responses
  submitResponse(body: SubmitResponseRequest): Promise<SubmitResponseResponse> {
    return request('POST', ENDPOINTS.submitResponse.path, body);
  },
  skipResponse(body: SkipRequest): Promise<void> {
    return request('POST', ENDPOINTS.skipResponse.path, body);
  },
  answered(): Promise<AnsweredResponse> {
    return request('GET', ENDPOINTS.answered.path);
  },

  // Respondent
  profile(): Promise<RespondentProfile> {
    return request('GET', ENDPOINTS.profile.path);
  },
  updateProfile(body: UpdateProfileRequest): Promise<RespondentProfile> {
    return request('PATCH', ENDPOINTS.updateProfile.path, body);
  },

  // Results
  publicResults(surveyId: string): Promise<SurveyResults> {
    const path = buildPath(ENDPOINTS.publicResults.path, { surveyId });
    return request('GET', path);
  },

  // Leaderboard
  leaderboard(): Promise<LeaderboardResponse> {
    return request('GET', ENDPOINTS.leaderboard.path);
  },

  // Stats (public — no auth required)
  communityStats(): Promise<CommunityStatsResponse> {
    return request('GET', ENDPOINTS.communityStats.path);
  },
};

export type { AuthResponse, RespondentProfile, CommunityStatsResponse };
