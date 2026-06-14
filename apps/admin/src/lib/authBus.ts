/**
 * Tiny event bus that lets apiClient trigger an auth logout without
 * creating a circular import between apiClient ↔ auth.
 */
let _logoutHandler: (() => void) | null = null;

export function registerLogoutHandler(fn: () => void): void {
  _logoutHandler = fn;
}

export function unregisterLogoutHandler(): void {
  _logoutHandler = null;
}

export function dispatchAuthLogout(): void {
  _logoutHandler?.();
}
