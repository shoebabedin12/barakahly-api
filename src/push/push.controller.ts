import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsString, MaxLength, ValidateNested } from 'class-validator';
import { CurrentAdmin } from '../admin-auth/decorators/current-admin.decorator.js';
import type { AdminJwtPayload } from '../admin-auth/guards/admin-jwt.guard.js';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { PushService } from './push.service.js';

class PushKeysDto {
  @IsString()
  @MaxLength(255)
  p256dh: string;

  @IsString()
  @MaxLength(255)
  auth: string;
}

class SubscribeDto {
  @IsString()
  @MaxLength(2000)
  endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

class UnsubscribeDto {
  @IsString()
  @MaxLength(2000)
  endpoint: string;
}

/** Admin\PushSubscriptionController - the bell in the admin header. */
@Controller('api/v1/admin/push')
@UseGuards(AdminJwtGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('public-key')
  publicKey() {
    return this.push.publicKey();
  }

  @Post('subscriptions')
  @HttpCode(200)
  subscribe(@CurrentAdmin() admin: AdminJwtPayload, @Body() dto: SubscribeDto) {
    return this.push.subscribe(admin.sub, dto);
  }

  @Delete('subscriptions')
  unsubscribe(@Body() dto: UnsubscribeDto) {
    return this.push.unsubscribe(dto.endpoint);
  }
}
