import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import type { OrderListQuery } from './dto/order-query.dto.js';
import {
  BulkUpdateOrderStatusDto,
  MergeOrderDto,
  UpdateOrderStatusDto,
  UpdatePaymentStatusDto,
} from './dto/update-status.dto.js';
import { OrdersService } from './orders.service.js';

@Controller('api/v1/admin/orders')
@UseGuards(AdminJwtGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const query: OrderListQuery = {
      page: page ? parseInt(page, 10) : undefined,
      status,
      paymentStatus,
      search,
      dateFrom,
      dateTo,
    };
    return this.ordersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto.orderStatus);
  }

  @Post('bulk-status')
  bulkUpdateStatus(@Body() dto: BulkUpdateOrderStatusDto) {
    return this.ordersService.bulkUpdateStatus(dto.ids, dto.orderStatus);
  }

  @Patch(':id/payment-status')
  updatePaymentStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePaymentStatusDto) {
    return this.ordersService.updatePaymentStatus(id, dto.paymentStatus);
  }

  @Patch(':id/remove-shipping-charge')
  removeShippingCharge(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.removeShippingCharge(id);
  }

  @Post(':id/merge')
  merge(@Param('id', ParseIntPipe) id: number, @Body() dto: MergeOrderDto) {
    return this.ordersService.merge(id, dto.mergeOrderId);
  }
}
