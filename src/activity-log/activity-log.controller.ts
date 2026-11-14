import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { SuperAdminGuard } from '../admin-auth/guards/super-admin.guard.js';
import { pageNumber } from '../store-admin/admin-page.js';
import { ActivityLogService } from './activity-log.service.js';

const isoDate = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

@Controller('api/v1/admin/activity-log')
@UseGuards(AdminJwtGuard, SuperAdminGuard)
export class ActivityLogController {
  constructor(private readonly service: ActivityLogService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const user = Number.parseInt(userId ?? '', 10);
    return this.service.findAll(pageNumber(page), {
      userId: Number.isFinite(user) ? user : undefined,
      action: action || undefined,
      dateFrom: isoDate(dateFrom),
      dateTo: isoDate(dateTo),
    });
  }
}
