import {
  ConflictException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { canChangeNickname, validateNickname } from '@mhm/shared';
import type { Category } from '@mhm/shared';
import type { RespondentProfile } from '@mhm/contracts';

import { PrismaService } from '../../common/prisma/prisma.service';
import { buildRespondentProfile } from '../../common/profile.mapper';
import { GAMIFICATION_SERVICE, IGamificationService } from '../../common/facades';

import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class RespondentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GAMIFICATION_SERVICE)
    private readonly gamification: IGamificationService,
  ) {}

  async getProfile(respondentId: string): Promise<RespondentProfile> {
    const respondent = await this.prisma.respondent.findUnique({
      where: { id: respondentId },
    });
    if (!respondent) throw new NotFoundException('Respondent not found');

    const extras = await this.gamification.getProfileGamification(respondentId);
    return buildRespondentProfile(respondent, extras);
  }

  async updateProfile(
    respondentId: string,
    dto: UpdateProfileDto,
  ): Promise<RespondentProfile> {
    const respondent = await this.prisma.respondent.findUnique({
      where: { id: respondentId },
    });
    if (!respondent) throw new NotFoundException('Respondent not found');

    const updateData: Record<string, unknown> = {};

    // Nickname handling.
    if (dto.nickname !== undefined) {
      if (dto.nickname !== null) {
        const validation = validateNickname(dto.nickname);
        if (!validation.valid) {
          throw new BadRequestException(`Invalid nickname: ${validation.reason}`);
        }
        if (!canChangeNickname(respondent.nicknameChangedAt)) {
          throw new ConflictException('Nickname can only be changed once every 30 days');
        }
        updateData.nickname = dto.nickname;
        updateData.nicknameChangedAt = new Date();
      } else {
        // Allow clearing a nickname.
        updateData.nickname = null;
      }
    }

    if (dto.showInLeaderboard !== undefined) {
      updateData.showInLeaderboard = dto.showInLeaderboard;
    }

    if (dto.preferredLanguage !== undefined) {
      updateData.preferredLanguage = dto.preferredLanguage;
    }

    if (dto.preferredCategories !== undefined) {
      updateData.preferredCategories = dto.preferredCategories as Category[];
    }

    if (dto.demographics !== undefined) {
      const { age, gender, region } = dto.demographics;
      if (age !== undefined) updateData.age = age ?? null;
      if (gender !== undefined) updateData.gender = gender ?? null;
      if (region !== undefined) updateData.region = region ?? null;
    }

    let updated: typeof respondent;
    try {
      updated = await this.prisma.respondent.update({
        where: { id: respondentId },
        data: updateData,
      });
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException('Nickname is already taken');
      }
      throw err;
    }

    const extras = await this.gamification.getProfileGamification(respondentId);
    return buildRespondentProfile(updated, extras);
  }
}

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}
