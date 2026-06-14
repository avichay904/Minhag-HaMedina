import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './apiClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 401/403/404
        if (error instanceof ApiRequestError && [401, 403, 404].includes(error.statusCode)) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});
