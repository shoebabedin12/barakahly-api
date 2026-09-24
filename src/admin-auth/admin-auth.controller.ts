import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service.js';
import { CurrentAdmin } from './decorators/current-admin.decorator.js';
import { LoginDto } from './dto/login.dto.js';
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

  @Get('me')
  @UseGuards(AdminJwtGuard)
  me(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.adminAuth.me(admin.sub);
  }
}
