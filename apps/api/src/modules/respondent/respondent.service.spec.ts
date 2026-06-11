import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BadgeType, Language, Rank } from '@mhm/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { GAMIFICATION_SERVICE, type IGamificationService } from '../../common/facades';

import { RespondentService } from './respondent.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_RESPONDENT = {
  id: 'resp-1',
  nickname: null,
  nicknameChangedAt: null,
  trustScore: 0.8,
  showInLeaderboard: false,
  preferredLanguage: 'HE',
  preferredCategories: [],
  age: null,
  gender: null,
  region: null,
  authProvider: 'GOOGLE',
  externalId: null,
  sourceId: null,
  fingerprintHash: null,
  email: null,
  notificationToken: null,
  points: 10,
  answeredCount: 5,
  flagged: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const FAKE_PROFILE_GAMIFICATION = {
  rank: Rank.BEGINNER,
  badges: [BadgeType.STREAK],
  points: 10,
  surveysCompleted: 5,
  rankProgress: {
    current: Rank.BEGINNER,
    next: Rank.CONTRIBUTOR,
    surveysToNext: 10,
    trustBlockedNext: false,
  },
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    respondent: {
      findUnique: vi.fn().mockResolvedValue({ ...BASE_RESPONDENT }),
      update: vi.fn().mockResolvedValue({ ...BASE_RESPONDENT }),
    },
  };
}

function buildGamificationMock(): IGamificationService {
  return {
    onResponseRecorded: vi.fn(),
    generateChallengeForCycle: vi.fn(),
    getProfileGamification: vi.fn().mockResolvedValue(FAKE_PROFILE_GAMIFICATION),
  };
}

async function buildModule(overrides: {
  prisma?: ReturnType<typeof buildPrismaMock>;
  gamification?: IGamificationService;
} = {}): Promise<{
  service: RespondentService;
  prisma: ReturnType<typeof buildPrismaMock>;
  gamification: IGamificationService;
}> {
  const prisma = overrides.prisma ?? buildPrismaMock();
  const gamification = overrides.gamification ?? buildGamificationMock();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RespondentService,
      { provide: PrismaService, useValue: prisma },
      { provide: GAMIFICATION_SERVICE, useValue: gamification },
    ],
  }).compile();

  return {
    service: module.get(RespondentService),
    prisma,
    gamification,
  };
}

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------

describe('RespondentService.getProfile', () => {
  it('returns a RespondentProfile for an existing respondent', async () => {
    const { service } = await buildModule();

    const profile = await service.getProfile('resp-1');

    expect(profile.id).toBe('resp-1');
    expect(profile.rank).toBe(Rank.BEGINNER);
    expect(profile.badges).toContain(BadgeType.STREAK);
  });

  it('throws NotFoundException when respondent does not exist', async () => {
    const prisma = buildPrismaMock();
    prisma.respondent.findUnique.mockResolvedValue(null);

    const { service } = await buildModule({ prisma });

    await expect(service.getProfile('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('calls gamification.getProfileGamification with the respondentId', async () => {
    const { service, gamification } = await buildModule();

    await service.getProfile('resp-1');

    expect(gamification.getProfileGamification).toHaveBeenCalledWith('resp-1');
  });
});

// ---------------------------------------------------------------------------
// updateProfile — nickname validation
// ---------------------------------------------------------------------------

describe('RespondentService.updateProfile — nickname', () => {
  it('throws BadRequestException for a nickname that is too short', async () => {
    const { service } = await buildModule();

    const dto = { nickname: 'ab' } as UpdateProfileDto;

    await expect(service.updateProfile('resp-1', dto)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for a nickname with invalid characters', async () => {
    const { service } = await buildModule();

    const dto = { nickname: 'hello world!' } as UpdateProfileDto;

    await expect(service.updateProfile('resp-1', dto)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for a nickname that is too long (>20)', async () => {
    const { service } = await buildModule();

    const dto = { nickname: 'a'.repeat(21) } as UpdateProfileDto;

    await expect(service.updateProfile('resp-1', dto)).rejects.toThrow(BadRequestException);
  });

  it('throws ConflictException when nickname was changed less than 30 days ago', async () => {
    const recentChange = new Date();
    recentChange.setDate(recentChange.getDate() - 5); // 5 days ago

    const prisma = buildPrismaMock();
    prisma.respondent.findUnique.mockResolvedValue({
      ...BASE_RESPONDENT,
      nickname: 'oldname',
      nicknameChangedAt: recentChange,
    });

    const { service } = await buildModule({ prisma });

    const dto = { nickname: 'newname' } as UpdateProfileDto;

    await expect(service.updateProfile('resp-1', dto)).rejects.toThrow(ConflictException);
  });

  it('allows nickname change when last change was > 30 days ago', async () => {
    const oldChange = new Date();
    oldChange.setDate(oldChange.getDate() - 31); // 31 days ago

    const prisma = buildPrismaMock();
    prisma.respondent.findUnique.mockResolvedValue({
      ...BASE_RESPONDENT,
      nickname: 'oldname',
      nicknameChangedAt: oldChange,
    });
    prisma.respondent.update.mockResolvedValue({
      ...BASE_RESPONDENT,
      nickname: 'newname',
      nicknameChangedAt: new Date(),
    });

    const { service } = await buildModule({ prisma });

    const dto = { nickname: 'newname' } as UpdateProfileDto;
    const profile = await service.updateProfile('resp-1', dto);

    expect(profile.nickname).toBe('newname');
    expect(prisma.respondent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nickname: 'newname' }),
      }),
    );
  });

  it('allows nickname change when nicknameChangedAt is null (never changed)', async () => {
    const prisma = buildPrismaMock();
    prisma.respondent.findUnique.mockResolvedValue({
      ...BASE_RESPONDENT,
      nicknameChangedAt: null,
    });
    prisma.respondent.update.mockResolvedValue({
      ...BASE_RESPONDENT,
      nickname: 'freshname',
      nicknameChangedAt: new Date(),
    });

    const { service } = await buildModule({ prisma });

    const dto = { nickname: 'freshname' } as UpdateProfileDto;
    const profile = await service.updateProfile('resp-1', dto);

    expect(profile.nickname).toBe('freshname');
  });

  it('throws ConflictException (409) when Prisma unique constraint P2002 is thrown', async () => {
    const prisma = buildPrismaMock();
    prisma.respondent.findUnique.mockResolvedValue({
      ...BASE_RESPONDENT,
      nicknameChangedAt: null,
    });
    prisma.respondent.update.mockRejectedValue({ code: 'P2002' });

    const { service } = await buildModule({ prisma });

    const dto = { nickname: 'takenname' } as UpdateProfileDto;

    await expect(service.updateProfile('resp-1', dto)).rejects.toThrow(ConflictException);
  });

  it('sets nicknameChangedAt to now when nickname is successfully changed', async () => {
    const prisma = buildPrismaMock();
    prisma.respondent.findUnique.mockResolvedValue({
      ...BASE_RESPONDENT,
      nicknameChangedAt: null,
    });
    prisma.respondent.update.mockResolvedValue({
      ...BASE_RESPONDENT,
      nickname: 'newname',
      nicknameChangedAt: new Date(),
    });

    const { service } = await buildModule({ prisma });

    await service.updateProfile('resp-1', { nickname: 'newname' } as UpdateProfileDto);

    const updateArg = prisma.respondent.update.mock.calls[0][0];
    expect(updateArg.data.nicknameChangedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// updateProfile — other fields
// ---------------------------------------------------------------------------

describe('RespondentService.updateProfile — other fields', () => {
  it('updates showInLeaderboard', async () => {
    const prisma = buildPrismaMock();
    prisma.respondent.update.mockResolvedValue({
      ...BASE_RESPONDENT,
      showInLeaderboard: true,
    });

    const { service } = await buildModule({ prisma });

    await service.updateProfile('resp-1', { showInLeaderboard: true } as UpdateProfileDto);

    expect(prisma.respondent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ showInLeaderboard: true }),
      }),
    );
  });

  it('updates preferredLanguage', async () => {
    const prisma = buildPrismaMock();
    prisma.respondent.update.mockResolvedValue({
      ...BASE_RESPONDENT,
      preferredLanguage: 'EN',
    });

    const { service } = await buildModule({ prisma });

    await service.updateProfile('resp-1', {
      preferredLanguage: Language.EN,
    } as UpdateProfileDto);

    expect(prisma.respondent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ preferredLanguage: Language.EN }),
      }),
    );
  });

  it('updates preferredCategories as an array', async () => {
    const categories = ['GENERAL', 'TECHNOLOGY'];
    const prisma = buildPrismaMock();
    prisma.respondent.update.mockResolvedValue({
      ...BASE_RESPONDENT,
      preferredCategories: categories,
    });

    const { service } = await buildModule({ prisma });

    await service.updateProfile('resp-1', {
      preferredCategories: categories as never,
    } as UpdateProfileDto);

    expect(prisma.respondent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ preferredCategories: categories }),
      }),
    );
  });

  it('flattens demographics fields (age/gender/region) into update data', async () => {
    const prisma = buildPrismaMock();
    prisma.respondent.update.mockResolvedValue({
      ...BASE_RESPONDENT,
      age: 30,
      gender: 'MALE',
      region: 'TLV',
    });

    const { service } = await buildModule({ prisma });

    await service.updateProfile('resp-1', {
      demographics: { age: 30, gender: 'MALE', region: 'TLV' },
    } as UpdateProfileDto);

    expect(prisma.respondent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ age: 30, gender: 'MALE', region: 'TLV' }),
      }),
    );
  });

  it('throws NotFoundException when respondent does not exist', async () => {
    const prisma = buildPrismaMock();
    prisma.respondent.findUnique.mockResolvedValue(null);

    const { service } = await buildModule({ prisma });

    await expect(
      service.updateProfile('nonexistent', { showInLeaderboard: false } as UpdateProfileDto),
    ).rejects.toThrow(NotFoundException);
  });
});
