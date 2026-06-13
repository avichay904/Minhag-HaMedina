import { ENDPOINTS, buildPath } from '@mhm/contracts';
import type {
  AdminSurveyDto,
  AdminCycleRow,
  AdminQuestionDto,
  CreateQuestionRequest,
  CreateSurveyRequest,
  SourceDto,
  CreateSourceRequest,
  CreateSourceResponse,
  UpdateSourceRequest,
  SurveyResults,
  UploadImageResponse,
  ApiError,
} from '@mhm/contracts';

// ─── Token store ─────────────────────────────────────────────────────────────
const TOKEN_KEY = 'mhm_admin_token';

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Base URL ─────────────────────────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1') as string;

function resolveUrl(path: string): string {
  const base = BASE_URL.replace(/\/+$/, '');
  return `${base}${path}`;
}

// ─── Typed error ──────────────────────────────────────────────────────────────
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
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getAdminToken();
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
      errorBody = { statusCode: res.status, message: res.statusText };
    }
    const msg = Array.isArray(errorBody.message)
      ? errorBody.message.join(', ')
      : errorBody.message;
    throw new ApiRequestError(res.status, msg, errorBody);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ─── Multipart upload ────────────────────────────────────────────────────────
async function uploadFile<T>(path: string, file: File, fieldName = 'file'): Promise<T> {
  const token = getAdminToken();
  const headers: Record<string, string> = { 'X-Source': 'web' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const formData = new FormData();
  formData.append(fieldName, file);

  const res = await fetch(resolveUrl(path), {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let errorBody: ApiError;
    try {
      errorBody = (await res.json()) as ApiError;
    } catch {
      errorBody = { statusCode: res.status, message: res.statusText };
    }
    const msg = Array.isArray(errorBody.message)
      ? errorBody.message.join(', ')
      : errorBody.message;
    throw new ApiRequestError(res.status, msg, errorBody);
  }

  return res.json() as Promise<T>;
}

// ─── Typed admin API ──────────────────────────────────────────────────────────
export const adminApi = {
  // Validate token
  validateToken(): Promise<AdminSurveyDto[]> {
    return request('GET', ENDPOINTS.adminListSurveys.path);
  },

  // Surveys
  listSurveys(): Promise<AdminSurveyDto[]> {
    return request('GET', ENDPOINTS.adminListSurveys.path);
  },
  createSurvey(body: CreateSurveyRequest): Promise<AdminSurveyDto> {
    return request('POST', ENDPOINTS.adminCreateSurvey.path, body);
  },
  listSurveyCycles(surveyId: string): Promise<AdminCycleRow[]> {
    const path = buildPath(ENDPOINTS.adminListSurveyCycles.path, { id: surveyId });
    return request('GET', path);
  },

  // Cycles (literal paths — not in ENDPOINTS)
  openCycle(surveyId: string): Promise<AdminCycleRow> {
    return request('POST', `/surveys/${surveyId}/cycles`);
  },
  closeCycle(cycleId: string): Promise<AdminCycleRow> {
    return request('POST', `/cycles/${cycleId}/close`);
  },
  approveCycle(cycleId: string): Promise<AdminCycleRow> {
    return request('POST', `/cycles/${cycleId}/approve`);
  },
  publishCycle(cycleId: string): Promise<AdminCycleRow> {
    return request('POST', `/cycles/${cycleId}/publish`);
  },

  // Questions
  listQuestions(surveyId?: string): Promise<AdminQuestionDto[]> {
    const path = surveyId
      ? `${ENDPOINTS.adminListQuestions.path}?surveyId=${surveyId}`
      : ENDPOINTS.adminListQuestions.path;
    return request('GET', path);
  },
  createQuestion(body: CreateQuestionRequest): Promise<AdminQuestionDto> {
    return request('POST', ENDPOINTS.createQuestion.path, body);
  },

  // Image upload
  uploadImage(file: File): Promise<UploadImageResponse> {
    return uploadFile(ENDPOINTS.uploadImage.path, file, 'file');
  },

  // Results
  getResults(surveyId: string): Promise<SurveyResults> {
    const path = buildPath(ENDPOINTS.results.path, { surveyId });
    return request('GET', path);
  },

  // Sources
  listSources(): Promise<SourceDto[]> {
    return request('GET', ENDPOINTS.adminListSources.path);
  },
  createSource(body: CreateSourceRequest): Promise<CreateSourceResponse> {
    return request('POST', ENDPOINTS.adminCreateSource.path, body);
  },
  updateSource(id: string, body: UpdateSourceRequest): Promise<SourceDto> {
    const path = buildPath(ENDPOINTS.adminUpdateSource.path, { id });
    return request('PATCH', path, body);
  },
};
