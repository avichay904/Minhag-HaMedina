import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthResponse } from '@mhm/contracts';

import { Public } from '../../common/decorators/auth.decorators';

import { AnonymousLoginDto, SocialLoginDto } from './dto/auth.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticate via a Google or Apple OAuth token.
   * Creates a new respondent on first login; returns an existing one thereafter.
   */
  @Public()
  @Post('social')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Social (Google / Apple) login or register' })
  @ApiOkResponse({ description: 'JWT token + respondent profile' })
  socialLogin(@Body() dto: SocialLoginDto): Promise<AuthResponse> {
    return this.authService.socialLogin(dto);
  }

  /**
   * Authenticate as an anonymous respondent.
   * When a fingerprint is supplied the same anonymous respondent is reused across sessions;
   * otherwise a fresh anonymous respondent is created.
   */
  @Public()
  @Post('anonymous')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anonymous login (fingerprint-optional)' })
  @ApiOkResponse({ description: 'JWT token + respondent profile' })
  anonymousLogin(@Body() dto: AnonymousLoginDto): Promise<AuthResponse> {
    return this.authService.anonymousLogin(dto);
  }
}
