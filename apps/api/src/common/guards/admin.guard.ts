import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Principal } from '@mhm/shared';
import { extractBearer } from './auth.guard';

/**
 * Protects Admin-only routes. Accepts either an admin JWT principal or the static
 * `ADMIN_API_TOKEN` as a bearer token (Phase A has no graphical admin login).
 * Admin routes should also be marked @Public so the global JWT guard steps aside.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const principal: Principal | undefined = request.principal;

    if (principal?.type === 'admin') return true;

    const token = extractBearer(request.headers['authorization']);
    const adminToken = this.config.get<string>('adminToken');
    if (token && adminToken && token === adminToken) {
      request.principal = { type: 'admin', xSource: request.xSource ?? 'WEB', trustScore: 1.0 };
      return true;
    }

    throw new ForbiddenException('Admin privileges required');
  }
}
