import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Principal } from '@mhm/shared';
import { MIN_TRUST_KEY } from '../decorators/auth.decorators';

/** Enforces a route-level minimum Trust Score declared with @MinTrust(n). */
@Injectable()
export class TrustGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const min = this.reflector.getAllAndOverride<number | undefined>(MIN_TRUST_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (min == null) return true;

    const principal: Principal | undefined = context.switchToHttp().getRequest().principal;
    if (!principal || principal.trustScore < min) {
      throw new ForbiddenException(`Requires Trust Score >= ${min}`);
    }
    return true;
  }
}
