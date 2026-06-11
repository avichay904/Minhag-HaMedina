import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Public } from '../../common/decorators/auth.decorators';
import { CycleService } from './cycle.service';
import type { CycleInfo } from '../../common/facades';

/**
 * Admin-only cycle lifecycle endpoints.
 * All routes are @Public so the global JWT guard steps aside; AdminGuard
 * enforces admin credentials instead.
 */
@ApiTags('cycles')
@Controller('cycles')
export class CycleController {
  constructor(private readonly cycleService: CycleService) {}

  /** POST /cycles/:id/close — closes an open cycle, deactivates expired questions. */
  @Public()
  @UseGuards(AdminGuard)
  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a cycle (admin)' })
  close(@Param('id') id: string): Promise<CycleInfo> {
    return this.cycleService.closeCycle(id);
  }

  /** POST /cycles/:id/approve — marks a closed cycle as approved. */
  @Public()
  @UseGuards(AdminGuard)
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a cycle (admin)' })
  approve(@Param('id') id: string): Promise<CycleInfo> {
    return this.cycleService.approveCycle(id);
  }

  /** POST /cycles/:id/publish — publishes an approved cycle for public results. */
  @Public()
  @UseGuards(AdminGuard)
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a cycle (admin)' })
  publish(@Param('id') id: string): Promise<CycleInfo> {
    return this.cycleService.publishCycle(id);
  }
}
