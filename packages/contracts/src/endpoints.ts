/**
 * The single source of truth for every Phase-A route.
 * Path params use `:param` style; `buildPath` substitutes them.
 * Both the API (route definitions / validation) and the clients (typed apiClient)
 * import from here so nobody hand-writes a URL twice.
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface EndpointDef {
  method: HttpMethod;
  path: string;
}

export const API_VERSION = 'v1';
export const API_PREFIX = `api/${API_VERSION}`;

export const ENDPOINTS = {
  // Auth
  socialLogin: { method: 'POST', path: '/auth/social' },
  anonymousLogin: { method: 'POST', path: '/auth/anonymous' },
  powChallenge: { method: 'GET', path: '/auth/pow-challenge' },
  externalRegister: { method: 'POST', path: '/external/register' },
  externalRespondentUpdate: { method: 'PATCH', path: '/external/respondent/:id' },

  // Surveys & questions
  activeSurveys: { method: 'GET', path: '/surveys/active' },
  surveyQuestions: { method: 'GET', path: '/surveys/:id/questions' },
  createQuestion: { method: 'POST', path: '/questions' },

  // Responses
  submitResponse: { method: 'POST', path: '/responses' },
  skipResponse: { method: 'POST', path: '/responses/skip' },
  answered: { method: 'GET', path: '/respondent/answered' },

  // Respondent
  profile: { method: 'GET', path: '/respondent/profile' },
  updateProfile: { method: 'PATCH', path: '/respondent/profile' },

  // Results
  results: { method: 'GET', path: '/results/:surveyId' },
  publicResults: { method: 'GET', path: '/results/:surveyId/public' },
  externalResults: { method: 'GET', path: '/external/results' },
  leaderboard: { method: 'GET', path: '/leaderboard' },

  // Stats
  communityStats: { method: 'GET', path: '/stats/community' },

  // Uploads
  uploadImage: { method: 'POST', path: '/uploads/image' },

  // Admin — Survey management
  adminCreateSurvey: { method: 'POST', path: '/surveys' },
  adminListSurveys: { method: 'GET', path: '/surveys' },
  adminListSurveyCycles: { method: 'GET', path: '/surveys/:id/cycles' },

  // Admin — Question management
  adminListQuestions: { method: 'GET', path: '/questions' },

  // Admin — Source Registry
  adminListSources: { method: 'GET', path: '/sources' },
  adminCreateSource: { method: 'POST', path: '/sources' },
  adminUpdateSource: { method: 'PATCH', path: '/sources/:id' },
} as const satisfies Record<string, EndpointDef>;

export type EndpointName = keyof typeof ENDPOINTS;

/** Substitute `:param` segments, e.g. buildPath('/surveys/:id/questions', { id }) */
export function buildPath(path: string, params: Record<string, string | number> = {}): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    const value = params[key];
    if (value == null) throw new Error(`Missing path param: ${key}`);
    return encodeURIComponent(String(value));
  });
}
