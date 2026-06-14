import { SetMetadata } from '@nestjs/common';

/** Routes marked @Public skip the global JWT AuthGuard. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Routes marked @AdminOnly require an admin principal. */
export const ADMIN_ONLY_KEY = 'adminOnly';
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);

/** Routes marked @SourceAuth are authenticated via the external Source Registry (API key). */
export const SOURCE_AUTH_KEY = 'sourceAuth';
export const SourceAuth = () => SetMetadata(SOURCE_AUTH_KEY, true);

/** Routes marked @MinTrust(n) require principal.trustScore >= n. */
export const MIN_TRUST_KEY = 'minTrust';
export const MinTrust = (min: number) => SetMetadata(MIN_TRUST_KEY, min);
