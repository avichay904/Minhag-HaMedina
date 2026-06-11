import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Principal } from '@mhm/shared';
import type { RespondentProfile } from '@mhm/contracts';

import { CurrentPrincipal } from '../../common/decorators/principal.decorator';

import { RespondentService } from './respondent.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('respondent')
@Controller('respondent')
export class RespondentController {
  constructor(private readonly respondentService: RespondentService) {}

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the authenticated respondent profile' })
  @ApiOkResponse({ description: 'RespondentProfile' })
  getProfile(
    @CurrentPrincipal() principal: Principal,
  ): Promise<RespondentProfile> {
    return this.respondentService.getProfile(principal.respondentId!);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update the authenticated respondent profile' })
  @ApiOkResponse({ description: 'Updated RespondentProfile' })
  updateProfile(
    @CurrentPrincipal() principal: Principal,
    @Body() dto: UpdateProfileDto,
  ): Promise<RespondentProfile> {
    return this.respondentService.updateProfile(principal.respondentId!, dto);
  }
}
