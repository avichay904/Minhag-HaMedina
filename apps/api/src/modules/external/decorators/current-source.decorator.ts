import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ExternalSource } from '@prisma/client';

/**
 * Injects the ExternalSource record that SourceGuard attached to the request.
 * Only available on routes protected by @UseGuards(SourceGuard).
 */
export const CurrentSource = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ExternalSource => {
    return ctx.switchToHttp().getRequest().source;
  },
);
