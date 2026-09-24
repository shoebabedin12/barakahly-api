import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { DashboardService } from './dashboard.service.js';

@Controller('api/v1/admin/dashboard')
@UseGuards(AdminJwtGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getStats() {
    return this.dashboardService.getStats();
  }
}
