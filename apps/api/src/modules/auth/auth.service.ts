import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AuthProvider, Language, resolveTrustScore } from '@mhm/shared';
import type { AuthResponse } from '@mhm/contracts';

import { PrismaService } from '../../common/prisma/prisma.service';
import { IdentityService } from '../../common/identity/identity.service';
import { sha256 } from '../../common/crypto.util';
import { buildRespondentProfile } from '../../common/profile.mapper';
import { GAMIFICATION_SERVICE, IGamificationService } from '../../common/facades';
import type { JwtPayload } from '../../common/types/jwt-payload';
import { PowService } from '../pow/pow.service';

import type { SocialLoginDto } from './dto/auth.dto';
import type { AnonymousLoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly pow: PowService,
    @Inject(GAMIFICATION_SERVICE)
    private readonly gamification: IGamificationService,
  ) {}

  async socialLogin(dto: SocialLoginDto): Promise<AuthResponse> {
    const verified = await this.identity.verify(dto.provider as AuthProvider, dto.token);

    let respondent = await this.prisma.respondent.findFirst({
      where: {
        authProvider: dto.provider,
        externalId: verified.externalId,
      },
    });

    if (!respondent) {
      const trustScore = resolveTrustScore({ authProvider: dto.provider as AuthProvider });
      respondent = await this.prisma.respondent.create({
        data: {
          authProvider: dto.provider,
          externalId: verified.externalId,
          email: verified.email ?? null,
          trustScore,
          preferredLanguage: dto.preferredLanguage ?? Language.HE,
        },
      });
    }

    const token = this.signJwt(respondent);
    const profileGamification = await this.gamification.getProfileGamification(respondent.id);
    const profile = buildRespondentProfile(respondent, profileGamification);

    return { token, respondent: profile };
  }

  async anonymousLogin(dto: AnonymousLoginDto): Promise<AuthResponse> {
    const powEnabled = this.config.get<boolean>('pow.enabled') ?? false;

    if (powEnabled) {
      if (!dto.powChallenge || !dto.powNonce) {
        throw new BadRequestException(
          'Proof-of-Work challenge and nonce are required when POW_ENABLED=true',
        );
      }
      // Throws BadRequestException on verification failure
      this.pow.verify(dto.powChallenge, dto.powNonce);
    }

    const trustScore = resolveTrustScore({ authProvider: AuthProvider.ANONYMOUS });

    const respondent = await this.findOrCreateAnonymous(
      dto.fingerprint ?? null,
      dto.preferredLanguage ?? Language.HE,
      trustScore,
    );

    const token = this.signJwt(respondent);
    const profileGamification = await this.gamification.getProfileGamification(respondent.id);
    const profile = buildRespondentProfile(respondent, profileGamification);

    return { token, respondent: profile };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async findOrCreateAnonymous(
    fingerprint: string | null,
    preferredLanguage: Language,
    trustScore: number,
  ) {
    if (fingerprint) {
      const fingerprintHash = sha256(fingerprint);
      const existing = await this.prisma.respondent.findFirst({
        where: {
          authProvider: AuthProvider.ANONYMOUS,
          fingerprintHash,
        },
      });

      if (existing) return existing;

      return this.prisma.respondent.create({
        data: {
          authProvider: AuthProvider.ANONYMOUS,
          fingerprintHash,
          trustScore,
          preferredLanguage,
        },
      });
    }

    // No fingerprint — always create a fresh anonymous respondent.
    return this.prisma.respondent.create({
      data: {
        authProvider: AuthProvider.ANONYMOUS,
        trustScore,
        preferredLanguage,
      },
    });
  }

  private signJwt(respondent: {
    id: string;
    authProvider: string;
    trustScore: number;
  }): string {
    const payload: JwtPayload = {
      sub: respondent.id,
      type: 'respondent',
      authProvider: respondent.authProvider as AuthProvider,
      trustScore: respondent.trustScore,
    };
    return this.jwt.sign(payload);
  }
}
