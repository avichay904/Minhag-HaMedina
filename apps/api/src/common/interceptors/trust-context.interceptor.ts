import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { ANONYMOUS_TRUST } from '@mhm/shared';
import type { Observable } from 'rxjs';

/**
 * Normalises the per-request trust context. The principal's Trust Score is resolved
 * once at authentication time (login/source key) and carried on the principal; this
 * interceptor mirrors it onto `request.trustScore` so any handler can read a single,
 * consistent value (defaulting to the anonymous weight when unauthenticated).
 */
@Injectable()
export class TrustContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    request.trustScore = request.principal?.trustScore ?? ANONYMOUS_TRUST;
    return next.handle();
  }
}
