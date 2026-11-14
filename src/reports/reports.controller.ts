import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { pageNumber } from '../store-admin/admin-page.js';
import { ReportsService, type SalesFilters } from './reports.service.js';

const isoDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

function filters(query: Record<string, string | undefined>): SalesFilters {
  const customer = Number.parseInt(query.customerId ?? '', 10);
  return {
    status: query.status || undefined,
    paymentStatus: query.paymentStatus || undefined,
    customerId: Number.isFinite(customer) ? customer : undefined,
    couponOnly: query.coupon === '1' || query.coupon === 'true',
    from: isoDate(query.from),
    to: isoDate(query.to),
  };
}

@Controller('api/v1/admin/reports')
@UseGuards(AdminJwtGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('overview')
  overview() {
    return this.service.overview();
  }

  @Get('sales')
  sales(@Query() query: Record<string, string | undefined>) {
    return this.service.sales(filters(query), pageNumber(query.page));
  }

  @Get('sales/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sales-report.csv"')
  export(@Query() query: Record<string, string | undefined>) {
    return this.service.salesCsv(filters(query));
  }
}
