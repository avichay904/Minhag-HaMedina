import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CycleState } from '@mhm/shared';
import type { CycleInfo, ICycleService, IGamificationService } from '../../common/facades';
import { GAMIFICATION_SERVICE } from '../../common/facades';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CycleService implements ICycleService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GAMIFICATION_SERVICE)
    private readonly gamification: IGamificationService,
  ) {}

  /**
   * Opens a new cycle for the given survey.
   * Sequence = max existing sequence + 1.
   * After creation, triggers gamification challenge generation.
   */
  async openCycle(surveyId: string): Promise<CycleInfo> {
    const aggregate = await this.prisma.surveyCycle.aggregate({
      where: { surveyId },
      _max: { sequence: true },
    });

    const sequence = (aggregate._max.sequence ?? 0) + 1;

    const cycle = await this.prisma.surveyCycle.create({
      data: {
        surveyId,
        sequence,
        state: CycleState.OPEN,
        openedAt: new Date(),
      },
    });

    // Fire-and-forget style: challenge generation is a background concern; we do not block.
    await this.gamification.generateChallengeForCycle(cycle.id);

    return this.mapToInfo(cycle);
  }

  /**
   * Closes the given cycle.
   * - Sets state = CLOSED, closedAt = now.
   * - Deactivates questions whose cycle lifespan has been exhausted:
   *   (currentSequence - startCycleSequence) >= expiresAfterCycles
   */
  async closeCycle(cycleId: string): Promise<CycleInfo> {
    const cycle = await this.prisma.surveyCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException(`Cycle ${cycleId} not found`);

    const updated = await this.prisma.surveyCycle.update({
      where: { id: cycleId },
      data: { state: CycleState.CLOSED, closedAt: new Date() },
    });

    // Deactivate expired questions for the survey.
    // A question is expired when: currentSequence - startCycleSequence >= expiresAfterCycles
    // Translated: startCycleSequence <= currentSequence - expiresAfterCycles
    // We cannot do the arithmetic inside Prisma Json, so we fetch candidates and filter in code.
    const candidates = await this.prisma.question.findMany({
      where: {
        surveyId: cycle.surveyId,
        active: true,
        expiresAfterCycles: { not: null },
      },
      select: {
        id: true,
        startCycleSequence: true,
        expiresAfterCycles: true,
      },
    });

    const expiredIds = candidates
      .filter(
        (q) =>
          q.expiresAfterCycles != null &&
          cycle.sequence - q.startCycleSequence >= q.expiresAfterCycles,
      )
      .map((q) => q.id);

    if (expiredIds.length > 0) {
      await this.prisma.question.updateMany({
        where: { id: { in: expiredIds } },
        data: { active: false },
      });
    }

    return this.mapToInfo(updated);
  }

  /**
   * Approves the given cycle (sets state = APPROVED, records approver, sets publishedAt if not already set).
   */
  async approveCycle(cycleId: string, adminId?: string): Promise<CycleInfo> {
    const cycle = await this.prisma.surveyCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException(`Cycle ${cycleId} not found`);

    const updated = await this.prisma.surveyCycle.update({
      where: { id: cycleId },
      data: {
        state: CycleState.APPROVED,
        approvedById: adminId ?? null,
        publishedAt: cycle.publishedAt ?? new Date(),
      },
    });

    return this.mapToInfo(updated);
  }

  /**
   * Publishes the given cycle (sets state = PUBLISHED, sets publishedAt if not already set).
   */
  async publishCycle(cycleId: string): Promise<CycleInfo> {
    const cycle = await this.prisma.surveyCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException(`Cycle ${cycleId} not found`);

    const updated = await this.prisma.surveyCycle.update({
      where: { id: cycleId },
      data: {
        state: CycleState.PUBLISHED,
        publishedAt: cycle.publishedAt ?? new Date(),
      },
    });

    return this.mapToInfo(updated);
  }

  /**
   * Returns the current OPEN cycle for a survey, or null if none exists.
   */
  async getActiveCycle(surveyId: string): Promise<CycleInfo | null> {
    const cycle = await this.prisma.surveyCycle.findFirst({
      where: { surveyId, state: CycleState.OPEN },
      orderBy: { sequence: 'desc' },
    });

    return cycle ? this.mapToInfo(cycle) : null;
  }

  // ---------------------------------------------------------------------------
  // Mapping
  // ---------------------------------------------------------------------------

  private mapToInfo(cycle: {
    id: string;
    surveyId: string;
    sequence: number;
    state: string;
    displayMode: string;
    openedAt: Date;
    closedAt: Date | null;
    publishedAt: Date | null;
  }): CycleInfo {
    return {
      id: cycle.id,
      surveyId: cycle.surveyId,
      sequence: cycle.sequence,
      state: cycle.state as CycleInfo['state'],
      displayMode: cycle.displayMode as CycleInfo['displayMode'],
      openedAt: cycle.openedAt,
      closedAt: cycle.closedAt,
      publishedAt: cycle.publishedAt,
    };
  }
}
