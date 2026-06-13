import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SourceDto, CreateSourceResponse } from '@mhm/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { sha256, generateApiKey } from '../../common/crypto.util';
import type { CreateSourceDto, UpdateSourceDto } from './dto/admin-source.dto';

/**
 * Admin Source Registry service.
 * Manages ExternalSource records: list / create / patch.
 * apiKeyHash is NEVER returned in any response; only the raw key is returned once on creation.
 */
@Injectable()
export class AdminSourceService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /sources — list all sources (never exposing apiKeyHash). */
  async listSources(): Promise<SourceDto[]> {
    const sources = await this.prisma.externalSource.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return sources.map((s) => this.toDto(s));
  }

  /** POST /sources — create a new source; returns the record PLUS raw apiKey (once). */
  async createSource(dto: CreateSourceDto): Promise<CreateSourceResponse> {
    const rawKey = generateApiKey();
    const apiKeyHash = sha256(rawKey);

    const source = await this.prisma.externalSource.create({
      data: {
        name: dto.name,
        apiKeyHash,
        trustScoreMin: dto.trustScoreMin ?? 0.4,
        trustScoreMax: dto.trustScoreMax ?? 1.0,
        canRegisterUsers: dto.canRegisterUsers ?? false,
        canReadResults: dto.canReadResults ?? false,
        resultsScope: dto.resultsScope != null ? (dto.resultsScope as Prisma.InputJsonValue) : Prisma.JsonNull,
        active: dto.active ?? true,
      },
    });

    return {
      ...this.toDto(source),
      apiKey: rawKey,
    };
  }

  /** PATCH /sources/:id — partial update of an existing source. */
  async updateSource(id: string, dto: UpdateSourceDto): Promise<SourceDto> {
    const existing = await this.prisma.externalSource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Source ${id} not found`);

    // Build the update data object manually to handle Prisma.JsonNull correctly.
    const updateData: Prisma.ExternalSourceUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.trustScoreMin !== undefined) updateData.trustScoreMin = dto.trustScoreMin;
    if (dto.trustScoreMax !== undefined) updateData.trustScoreMax = dto.trustScoreMax;
    if (dto.canRegisterUsers !== undefined) updateData.canRegisterUsers = dto.canRegisterUsers;
    if (dto.canReadResults !== undefined) updateData.canReadResults = dto.canReadResults;
    if (dto.active !== undefined) updateData.active = dto.active;
    if ('resultsScope' in dto) {
      updateData.resultsScope =
        dto.resultsScope != null ? (dto.resultsScope as Prisma.InputJsonValue) : Prisma.JsonNull;
    }

    const updated = await this.prisma.externalSource.update({
      where: { id },
      data: updateData,
    });

    return this.toDto(updated);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private toDto(s: {
    id: string;
    name: string;
    trustScoreMin: number;
    trustScoreMax: number;
    canRegisterUsers: boolean;
    canReadResults: boolean;
    resultsScope: unknown;
    active: boolean;
    createdAt: Date;
  }): SourceDto {
    return {
      id: s.id,
      name: s.name,
      trustScoreMin: s.trustScoreMin,
      trustScoreMax: s.trustScoreMax,
      canRegisterUsers: s.canRegisterUsers,
      canReadResults: s.canReadResults,
      resultsScope: s.resultsScope ?? null,
      active: s.active,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
