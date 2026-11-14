import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { User } from '../users/user.entity.js';
import { ActivityLogController } from './activity-log.controller.js';
import { ActivityLog } from './activity-log.entity.js';
import { ActivityLogService } from './activity-log.service.js';

/** Global so any admin service can inject ActivityLogService and record what was done. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog, User]), AdminAuthModule],
  controllers: [ActivityLogController],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
