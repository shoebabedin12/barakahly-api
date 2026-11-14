import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service.js';
import { CurrentAdmin } from './decorators/current-admin.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import {
  TwoFactorChallengeDto,
  TwoFactorDisableDto,
  TwoFactorEnableDto,
} from './dto/two-factor.dto.js';
import type { AdminJwtPayload } from './guards/admin-jwt.guard.js';
import { AdminJwtGuard } from './guards/admin-jwt.guard.js';

/** Admin/staff auth for the new React admin panel - a separate `users`
 * table account, not a storefront `customers` one. */
@Controller('api/v1/admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuth: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  // Same 5-attempts intent as Laravel's LoginRequest::ensureIsNotRateLimited().
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.adminAuth.login(dto.email, dto.password);
  }

  @Post('2fa/challenge')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  challenge(@Body() dto: TwoFactorChallengeDto) {
    return this.adminAuth.challenge(dto.challengeToken, dto.code);
  }

  @Get('2fa')
  @UseGuards(AdminJwtGuard)
  twoFactorStatus(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.adminAuth.status(admin.sub);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  @UseGuards(AdminJwtGuard)
  twoFactorSetup(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.adminAuth.setup(admin.sub);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  @UseGuards(AdminJwtGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  twoFactorEnable(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() dto: TwoFactorEnableDto,
  ) {
    return this.adminAuth.enable(admin.sub, dto.setupToken, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @UseGuards(AdminJwtGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  twoFactorDisable(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() dto: TwoFactorDisableDto,
  ) {
    return this.adminAuth.disable(admin.sub, dto.password);
  }

  @Get('me')
  @UseGuards(AdminJwtGuard)
  me(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.adminAuth.me(admin.sub);
  }
}
