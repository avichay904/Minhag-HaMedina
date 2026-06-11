import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Principal } from '@mhm/shared';
import { PrismaService } from '../prisma/prisma.service';
import { sha256 } from '../crypto.util';
import { extractBearer } from './auth.guard';

/**
 * Authenticates an external source via its API key (Source Registry, SRS §7.2).
 * Attaches both the `ExternalSource` record (`request.source`) and a source principal.
 * Used on external routes (mark them @Public so the JWT guard steps aside).
 */
@Injectable()
export class SourceGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key =
      extractBearer(request.headers['authorization']) ??
      (request.headers['x-api-key'] as string | undefined);

    if (!key) throw new UnauthorizedException('Missing external source API key');

    const source = await this.prisma.externalSource.findUnique({
      where: { apiKeyHash: sha256(key) },
    });
    if (!source || !source.active) {
      throw new UnauthorizedException('Unknown or inactive external source');
    }

    request.source = source;
    const principal: Principal = {
      type: 'source',
      sourceId: source.id,
      xSource: 'EXTERNAL',
      trustScore: source.trustScoreMax,
    };
    request.principal = principal;
    return true;
  }
}
