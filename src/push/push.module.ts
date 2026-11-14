import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { PushSubscription } from './push-subscription.entity.js';
import { PushController } from './push.controller.js';
import { PushService } from './push.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription]), AdminAuthModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
