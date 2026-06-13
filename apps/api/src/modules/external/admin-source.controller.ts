import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SourceDto, CreateSourceResponse } from '@mhm/contracts';
import { Public } from '../../common/decorators/auth.decorators';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminSourceService } from './admin-source.service';
import { CreateSourceDto, UpdateSourceDto } from './dto/admin-source.dto';

/**
 * Admin Source Registry endpoints.
 * All routes are @Public (skipping the global JWT guard) + @UseGuards(AdminGuard).
 * apiKeyHash is NEVER returned; the raw apiKey is returned ONCE on POST /sources.
 */
@ApiTags('sources')
@Controller('sources')
export class AdminSourceController {
  constructor(private readonly adminSourceService: AdminSourceService) {}

  /**
   * GET /sources
   * List all ExternalSource records (never exposing apiKeyHash).
   */
  @Public()
  @UseGuards(AdminGuard)
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all external sources (admin)' })
  @ApiOkResponse({ description: 'External source list (apiKeyHash excluded)' })
  listSources(): Promise<SourceDto[]> {
    return this.adminSourceService.listSources();
  }

  /**
   * POST /sources
   * Create a new ExternalSource. Returns the source record plus the raw apiKey once.
   */
  @Public()
  @UseGuards(AdminGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an external source (admin)' })
  @ApiCreatedResponse({ description: 'Created source with raw apiKey (returned once)' })
  createSource(@Body() dto: CreateSourceDto): Promise<CreateSourceResponse> {
    return this.adminSourceService.createSource(dto);
  }

  /**
   * PATCH /sources/:id
   * Partially update an ExternalSource (permissions / active / scores).
   */
  @Public()
  @UseGuards(AdminGuard)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an external source (admin)' })
  @ApiOkResponse({ description: 'Updated source record' })
  updateSource(@Param('id') id: string, @Body() dto: UpdateSourceDto): Promise<SourceDto> {
    return this.adminSourceService.updateSource(id, dto);
  }
}
