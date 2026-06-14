import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Principal } from '@mhm/shared';

/** Injects the authenticated principal that AuthGuard/SourceGuard attached to the request. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.principal;
  },
);
