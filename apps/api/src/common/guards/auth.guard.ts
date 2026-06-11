import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Principal, XSource } from '@mhm/shared';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import type { JwtPayload } from '../types/jwt-payload';

/**
 * Global guard. Parses `Authorization: Bearer <jwt>` + `X-Source`, builds the
 * request `Principal`, and attaches it. Routes marked @Public are skipped
 * (their own SourceGuard/AdminGuard, if any, still runs afterwards).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    request.xSource = parseXSource(request.headers['x-source']);

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const token = extractBearer(request.headers['authorization']);

    // For public routes, attach a principal opportunistically if a token is present.
    if (isPublic) {
      if (token) this.tryAttach(request, token);
      return true;
    }

    if (!token) throw new UnauthorizedException('Missing bearer token');
    if (!this.tryAttach(request, token)) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return true;
  }

  private tryAttach(request: { principal?: Principal; xSource: XSource }, token: string): boolean {
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      const principal: Principal = {
        type: payload.type,
        respondentId: payload.type === 'respondent' ? payload.sub : undefined,
        adminId: payload.type === 'admin' ? payload.sub : undefined,
        sourceId: payload.sourceId,
        authProvider: payload.authProvider,
        xSource: request.xSource,
        trustScore: payload.trustScore,
      };
      request.principal = principal;
      return true;
    } catch {
      return false;
    }
  }
}

export function extractBearer(authHeader?: string): string | undefined {
  if (!authHeader) return undefined;
  const [scheme, value] = authHeader.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}

export function parseXSource(header?: string | string[]): XSource {
  const value = (Array.isArray(header) ? header[0] : header)?.toUpperCase();
  if (value === 'APP') return 'APP';
  if (value === 'EXTERNAL') return 'EXTERNAL';
  return 'WEB';
}
