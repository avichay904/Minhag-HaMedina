import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, Language, Rank } from '@mhm/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { IdentityService } from '../../common/identity/identity.service';
import { GAMIFICATION_SERVICE, type IGamificationService } from '../../common/facades';
import { PowService } from '../pow/pow.service';

import { AuthService } from './auth.service';
import type { SocialLoginDto } from './dto/auth.dto';
import type { AnonymousLoginDto } from './dto/auth.dto';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const FAKE_RESPONDENT_BASE = {
  id: 'respondent-1',
  authProvider: AuthProvider.GOOGLE,
  externalId: 'google-sub-123',
  email: 'user@example.com',
  nickname: null,
  trustScore: 1.0,
  fingerprintHash: null,
  preferredLanguage: Language.HE,
  preferredCategories: [],
  showInLeaderboard: true,
  age: null,
  gender: null,
  region: null,
};

const FAKE_PROFILE_GAMIFICATION = {
  rank: Rank.GUEST,
  badges: [],
  points: 0,
  surveysCompleted: 0,
  rankProgress: {
    current: Rank.GUEST,
    next: Rank.BEGINNER,
    surveysToNext: 3,
    trustBlockedNext: false,
  },
};

const FAKE_JWT = 'signed.jwt.token';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    respondent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
}

function buildIdentityMock() {
  return {
    verify: vi.fn().mockResolvedValue({
      provider: AuthProvider.GOOGLE,
      externalId: 'google-sub-123',
      email: 'user@example.com',
      name: 'Test User',
    }),
  };
}

function buildJwtMock() {
  return {
    sign: vi.fn().mockReturnValue(FAKE_JWT),
  };
}

function buildGamificationMock(): IGamificationService {
  return {
    onResponseRecorded: vi.fn(),
    generateChallengeForCycle: vi.fn(),
    getProfileGamification: vi.fn().mockResolvedValue(FAKE_PROFILE_GAMIFICATION),
  };
}

function buildConfigMock(powEnabled = false) {
  return {
    get: vi.fn((key: string) => {
      if (key === 'pow.enabled') return powEnabled;
      return undefined;
    }),
  };
}

function buildPowMock() {
  return {
    issue: vi.fn(),
    verify: vi.fn(), // no-op by default; throw to simulate failure
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildModule(
  prismaMock: ReturnType<typeof buildPrismaMock>,
  identityMock: ReturnType<typeof buildIdentityMock>,
  jwtMock: ReturnType<typeof buildJwtMock>,
  gamificationMock: IGamificationService,
  configMock = buildConfigMock(),
  powMock = buildPowMock(),
): Promise<AuthService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: IdentityService, useValue: identityMock },
      { provide: JwtService, useValue: jwtMock },
      { provide: ConfigService, useValue: configMock },
      { provide: PowService, useValue: powMock },
      { provide: GAMIFICATION_SERVICE, useValue: gamificationMock },
    ],
  }).compile();

  return module.get(AuthService);
}

// ---------------------------------------------------------------------------
// socialLogin tests
// ---------------------------------------------------------------------------

describe('AuthService.socialLogin', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let identity: ReturnType<typeof buildIdentityMock>;
  let jwtMock: ReturnType<typeof buildJwtMock>;
  let gamification: IGamificationService;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    identity = buildIdentityMock();
    jwtMock = buildJwtMock();
    gamification = buildGamificationMock();
    service = await buildModule(prisma, identity, jwtMock, gamification);
  });

  it('returns an AuthResponse for an existing respondent', async () => {
    prisma.respondent.findFirst.mockResolvedValue(FAKE_RESPONDENT_BASE);

    const dto = {
      provider: AuthProvider.GOOGLE,
      token: 'google-token',
      preferredLanguage: Language.HE,
    } satisfies SocialLoginDto;

    const result = await service.socialLogin(dto);

    expect(result.token).toBe(FAKE_JWT);
    expect(result.respondent.id).toBe(FAKE_RESPONDENT_BASE.id);
    expect(prisma.respondent.create).not.toHaveBeenCalled();
  });

  it('creates a new respondent when none exists and assigns correct trust score', async () => {
    prisma.respondent.findFirst.mockResolvedValue(null);
    const created = { ...FAKE_RESPONDENT_BASE };
    prisma.respondent.create.mockResolvedValue(created);

    const dto = {
      provider: AuthProvider.GOOGLE,
      token: 'google-token',
    } satisfies SocialLoginDto;

    await service.socialLogin(dto);

    expect(prisma.respondent.create).toHaveBeenCalledOnce();
    const callArg = prisma.respondent.create.mock.calls[0][0];
    expect(callArg.data.trustScore).toBe(1.0); // GOOGLE maps to 1.0
    expect(callArg.data.authProvider).toBe(AuthProvider.GOOGLE);
  });

  it('defaults preferredLanguage to HE when not supplied', async () => {
    prisma.respondent.findFirst.mockResolvedValue(null);
    prisma.respondent.create.mockResolvedValue(FAKE_RESPONDENT_BASE);

    const dto = { provider: AuthProvider.GOOGLE, token: 'token' } satisfies SocialLoginDto;
    await service.socialLogin(dto);

    const callArg = prisma.respondent.create.mock.calls[0][0];
    expect(callArg.data.preferredLanguage).toBe(Language.HE);
  });

  it('uses supplied preferredLanguage when provided', async () => {
    prisma.respondent.findFirst.mockResolvedValue(null);
    prisma.respondent.create.mockResolvedValue(FAKE_RESPONDENT_BASE);

    const dto = {
      provider: AuthProvider.GOOGLE,
      token: 'token',
      preferredLanguage: Language.EN,
    } satisfies SocialLoginDto;
    await service.socialLogin(dto);

    const callArg = prisma.respondent.create.mock.calls[0][0];
    expect(callArg.data.preferredLanguage).toBe(Language.EN);
  });

  it('looks up respondent by provider + externalId from verified identity', async () => {
    prisma.respondent.findFirst.mockResolvedValue(FAKE_RESPONDENT_BASE);

    await service.socialLogin({ provider: AuthProvider.APPLE, token: 'apple-token' } satisfies SocialLoginDto);

    expect(prisma.respondent.findFirst).toHaveBeenCalledWith({
      where: { authProvider: AuthProvider.APPLE, externalId: 'google-sub-123' },
    });
  });

  it('issues a JWT with correct payload fields', async () => {
    prisma.respondent.findFirst.mockResolvedValue(FAKE_RESPONDENT_BASE);

    await service.socialLogin({ provider: AuthProvider.GOOGLE, token: 'tok' } satisfies SocialLoginDto);

    expect(jwtMock.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: FAKE_RESPONDENT_BASE.id,
        type: 'respondent',
        authProvider: AuthProvider.GOOGLE,
        trustScore: 1.0,
      }),
    );
  });

  it('calls gamification.getProfileGamification with the respondent id', async () => {
    prisma.respondent.findFirst.mockResolvedValue(FAKE_RESPONDENT_BASE);

    await service.socialLogin({ provider: AuthProvider.GOOGLE, token: 'tok' } satisfies SocialLoginDto);

    expect(gamification.getProfileGamification).toHaveBeenCalledWith(FAKE_RESPONDENT_BASE.id);
  });
});

// ---------------------------------------------------------------------------
// anonymousLogin tests
// ---------------------------------------------------------------------------

describe('AuthService.anonymousLogin', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let identity: ReturnType<typeof buildIdentityMock>;
  let jwtMock: ReturnType<typeof buildJwtMock>;
  let gamification: IGamificationService;

  const ANON_RESPONDENT = {
    ...FAKE_RESPONDENT_BASE,
    id: 'anon-1',
    authProvider: AuthProvider.ANONYMOUS,
    externalId: null as unknown as string,
    email: null,
    trustScore: 0.4,
    fingerprintHash: null,
  };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    identity = buildIdentityMock();
    jwtMock = buildJwtMock();
    gamification = buildGamificationMock();
    service = await buildModule(prisma, identity, jwtMock, gamification);
  });

  it('creates a fresh anonymous respondent when no fingerprint provided', async () => {
    prisma.respondent.create.mockResolvedValue(ANON_RESPONDENT);

    const dto = {} satisfies AnonymousLoginDto;
    const result = await service.anonymousLogin(dto);

    expect(prisma.respondent.create).toHaveBeenCalledOnce();
    expect(prisma.respondent.findFirst).not.toHaveBeenCalled();
    expect(result.token).toBe(FAKE_JWT);
  });

  it('assigns ANONYMOUS trust score (0.4) to new anonymous respondents', async () => {
    prisma.respondent.create.mockResolvedValue(ANON_RESPONDENT);

    await service.anonymousLogin({} satisfies AnonymousLoginDto);

    const callArg = prisma.respondent.create.mock.calls[0][0];
    expect(callArg.data.trustScore).toBe(0.4);
    expect(callArg.data.authProvider).toBe(AuthProvider.ANONYMOUS);
  });

  it('reuses an existing anonymous respondent when fingerprint matches', async () => {
    const existingAnon = { ...ANON_RESPONDENT, fingerprintHash: 'some-hash' };
    prisma.respondent.findFirst.mockResolvedValue(existingAnon);

    const dto = { fingerprint: 'my-device-fp' } satisfies AnonymousLoginDto;
    await service.anonymousLogin(dto);

    expect(prisma.respondent.findFirst).toHaveBeenCalledOnce();
    expect(prisma.respondent.create).not.toHaveBeenCalled();
  });

  it('stores fingerprintHash (SHA-256) when fingerprint provided and no match exists', async () => {
    prisma.respondent.findFirst.mockResolvedValue(null);
    prisma.respondent.create.mockResolvedValue(ANON_RESPONDENT);

    const fingerprint = 'my-device-fingerprint';
    await service.anonymousLogin({ fingerprint } satisfies AnonymousLoginDto);

    expect(prisma.respondent.create).toHaveBeenCalledOnce();
    const callArg = prisma.respondent.create.mock.calls[0][0];
    // The hash must be deterministic SHA-256 hex (64 chars).
    expect(callArg.data.fingerprintHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('looks up existing anon respondent by fingerprintHash', async () => {
    prisma.respondent.findFirst.mockResolvedValue(null);
    prisma.respondent.create.mockResolvedValue(ANON_RESPONDENT);

    const fingerprint = 'fp-value';
    await service.anonymousLogin({ fingerprint } satisfies AnonymousLoginDto);

    const whereArg = prisma.respondent.findFirst.mock.calls[0][0].where;
    expect(whereArg.authProvider).toBe(AuthProvider.ANONYMOUS);
    expect(typeof whereArg.fingerprintHash).toBe('string');
    expect(whereArg.fingerprintHash).toHaveLength(64); // SHA-256 hex
  });

  it('defaults preferredLanguage to HE when not provided', async () => {
    prisma.respondent.create.mockResolvedValue(ANON_RESPONDENT);

    await service.anonymousLogin({} satisfies AnonymousLoginDto);

    const callArg = prisma.respondent.create.mock.calls[0][0];
    expect(callArg.data.preferredLanguage).toBe(Language.HE);
  });

  it('uses supplied preferredLanguage when provided', async () => {
    prisma.respondent.create.mockResolvedValue(ANON_RESPONDENT);

    await service.anonymousLogin({ preferredLanguage: Language.EN } satisfies AnonymousLoginDto);

    const callArg = prisma.respondent.create.mock.calls[0][0];
    expect(callArg.data.preferredLanguage).toBe(Language.EN);
  });

  it('issues a JWT with ANONYMOUS authProvider and 0.4 trust score', async () => {
    prisma.respondent.create.mockResolvedValue(ANON_RESPONDENT);

    await service.anonymousLogin({} satisfies AnonymousLoginDto);

    expect(jwtMock.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: ANON_RESPONDENT.id,
        type: 'respondent',
        authProvider: AuthProvider.ANONYMOUS,
        trustScore: 0.4,
      }),
    );
  });

  it('calls gamification.getProfileGamification with the respondent id', async () => {
    prisma.respondent.create.mockResolvedValue(ANON_RESPONDENT);

    await service.anonymousLogin({} satisfies AnonymousLoginDto);

    expect(gamification.getProfileGamification).toHaveBeenCalledWith(ANON_RESPONDENT.id);
  });
});

// ---------------------------------------------------------------------------
// anonymousLogin — PoW gating tests
// ---------------------------------------------------------------------------

describe('AuthService.anonymousLogin — PoW gating', () => {
  const ANON_RESPONDENT = {
    ...FAKE_RESPONDENT_BASE,
    id: 'anon-pow-1',
    authProvider: AuthProvider.ANONYMOUS,
    externalId: null as unknown as string,
    email: null,
    trustScore: 0.4,
    fingerprintHash: null,
  };

  it('proceeds without PoW fields when POW_ENABLED=false (default behaviour unchanged)', async () => {
    const prisma = buildPrismaMock();
    prisma.respondent.create.mockResolvedValue(ANON_RESPONDENT);

    const powMock = buildPowMock();
    const service = await buildModule(
      prisma,
      buildIdentityMock(),
      buildJwtMock(),
      buildGamificationMock(),
      buildConfigMock(false),
      powMock,
    );

    await service.anonymousLogin({});

    // pow.verify must NOT be called when PoW is disabled
    expect(powMock.verify).not.toHaveBeenCalled();
    expect(prisma.respondent.create).toHaveBeenCalledOnce();
  });

  it('throws BadRequest when POW_ENABLED=true and no challenge/nonce supplied', async () => {
    const prisma = buildPrismaMock();
    const powMock = buildPowMock();
    const service = await buildModule(
      prisma,
      buildIdentityMock(),
      buildJwtMock(),
      buildGamificationMock(),
      buildConfigMock(true),
      powMock,
    );

    await expect(service.anonymousLogin({})).rejects.toThrow(
      'Proof-of-Work challenge and nonce are required when POW_ENABLED=true',
    );

    expect(powMock.verify).not.toHaveBeenCalled();
    expect(prisma.respondent.create).not.toHaveBeenCalled();
  });

  it('throws BadRequest when POW_ENABLED=true and only challenge is supplied', async () => {
    const prisma = buildPrismaMock();
    const powMock = buildPowMock();
    const service = await buildModule(
      prisma,
      buildIdentityMock(),
      buildJwtMock(),
      buildGamificationMock(),
      buildConfigMock(true),
      powMock,
    );

    await expect(
      service.anonymousLogin({ powChallenge: 'abc.sig' }),
    ).rejects.toThrow('Proof-of-Work challenge and nonce are required when POW_ENABLED=true');
  });

  it('calls pow.verify with challenge+nonce when POW_ENABLED=true and both fields present', async () => {
    const prisma = buildPrismaMock();
    prisma.respondent.create.mockResolvedValue(ANON_RESPONDENT);
    const powMock = buildPowMock();

    const service = await buildModule(
      prisma,
      buildIdentityMock(),
      buildJwtMock(),
      buildGamificationMock(),
      buildConfigMock(true),
      powMock,
    );

    await service.anonymousLogin({ powChallenge: 'challenge.sig', powNonce: 'nonce-val' });

    expect(powMock.verify).toHaveBeenCalledOnce();
    expect(powMock.verify).toHaveBeenCalledWith('challenge.sig', 'nonce-val');
  });

  it('propagates the exception thrown by pow.verify when nonce is invalid', async () => {
    const { BadRequestException } = await import('@nestjs/common');

    const prisma = buildPrismaMock();
    const powMock = buildPowMock();
    powMock.verify.mockImplementation(() => {
      throw new BadRequestException('PoW nonce does not satisfy difficulty requirement');
    });

    const service = await buildModule(
      prisma,
      buildIdentityMock(),
      buildJwtMock(),
      buildGamificationMock(),
      buildConfigMock(true),
      powMock,
    );

    await expect(
      service.anonymousLogin({ powChallenge: 'challenge.sig', powNonce: 'bad-nonce' }),
    ).rejects.toThrow('PoW nonce does not satisfy difficulty requirement');

    expect(prisma.respondent.create).not.toHaveBeenCalled();
  });
});
