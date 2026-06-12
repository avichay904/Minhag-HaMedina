import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENDPOINTS, buildPath } from '@mhm/contracts';
import type {
  AuthResponse,
  QuestionDto,
  SubmitResponseRequest,
  SubmitResponseResponse,
  SkipRequest,
  RespondentProfile,
  LeaderboardResponse,
  LeaderboardEntry,
  ActiveSurveysResponse,
  QuestionsResponse,
  CommunityStatsResponse,
} from '@mhm/contracts';

const TOKEN_KEY = 'mhm_jwt';

const BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL) ||
  'http://localhost:3000/api/v1';

// ── Token helpers ──────────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

// ── Fetch wrapper ──────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  authenticated = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Source': 'app',
  };

  if (authenticated) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function loginAnonymous(): Promise<AuthResponse> {
  const ep = ENDPOINTS.anonymousLogin;
  const data = await request<AuthResponse>(ep.method, ep.path, {}, false);
  await setToken(data.token);
  return data;
}

export interface DevGoogleLoginParams {
  id: string;
  name: string;
}

export async function loginDevGoogle({ id, name }: DevGoogleLoginParams): Promise<AuthResponse> {
  const ep = ENDPOINTS.socialLogin;
  const data = await request<AuthResponse>(
    ep.method,
    ep.path,
    {
      provider: 'GOOGLE',
      token: `dev:${id}:${name}@dev.local`,
    },
    false,
  );
  await setToken(data.token);
  return data;
}

// ── Surveys ────────────────────────────────────────────────────────────────────

export async function fetchActiveSurveys(): Promise<ActiveSurveysResponse> {
  const ep = ENDPOINTS.activeSurveys;
  return request<ActiveSurveysResponse>(ep.method, ep.path);
}

export async function fetchSurveyQuestions(surveyId: string): Promise<QuestionsResponse> {
  const ep = ENDPOINTS.surveyQuestions;
  const path = buildPath(ep.path, { id: surveyId });
  return request<QuestionsResponse>(ep.method, path);
}

// ── Responses ──────────────────────────────────────────────────────────────────

export async function submitResponse(
  payload: SubmitResponseRequest,
): Promise<SubmitResponseResponse> {
  const ep = ENDPOINTS.submitResponse;
  return request<SubmitResponseResponse>(ep.method, ep.path, payload);
}

export async function skipQuestion(questionId: string): Promise<void> {
  const ep = ENDPOINTS.skipResponse;
  const payload: SkipRequest = { questionId };
  return request<void>(ep.method, ep.path, payload);
}

// ── Respondent ────────────────────────────────────────────────────────────────

export async function fetchProfile(): Promise<RespondentProfile> {
  const ep = ENDPOINTS.profile;
  return request<RespondentProfile>(ep.method, ep.path);
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const ep = ENDPOINTS.leaderboard;
  return request<LeaderboardResponse>(ep.method, ep.path);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function fetchCommunityStats(): Promise<CommunityStatsResponse> {
  const ep = ENDPOINTS.communityStats;
  return request<CommunityStatsResponse>(ep.method, ep.path, undefined, false);
}

// Re-export types we need in screens
export type {
  QuestionDto,
  SubmitResponseResponse,
  RespondentProfile,
  LeaderboardResponse,
  LeaderboardEntry,
  CommunityStatsResponse,
};
