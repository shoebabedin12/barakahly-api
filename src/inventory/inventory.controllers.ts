import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { pageNumber } from '../store-admin/admin-page.js';
import {
  InvestmentDto,
  PurchaseCostDto,
  PurchaseDto,
  PurchasePaymentDto,
  SupplierDto,
  SupplierPaymentDto,
} from './dto/inventory.dto.js';
import {
  InvestmentsAdminService,
  PurchasesAdminService,
  SuppliersAdminService,
} from './inventory.services.js';

@Controller('api/v1/admin/suppliers')
@UseGuards(AdminJwtGuard)
export class SuppliersAdminController {
  constructor(private readonly service: SuppliersAdminService) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.service.findAll(pageNumber(page));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.detail(id);
  }

  @Post()
  create(@Body() dto: SupplierDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: SupplierDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Supplier deleted successfully.' };
  }

  @Post(':id/payments')
  addPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SupplierPaymentDto,
  ) {
    return this.service.addPayment(id, dto);
  }

  @Delete(':id/payments/:paymentId')
  async removePayment(
    @Param('id', ParseIntPipe) id: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    await this.service.removePayment(id, paymentId);
    return { message: 'Payment deleted successfully.' };
  }
}

@Controller('api/v1/admin/purchases')
@UseGuards(AdminJwtGuard)
export class PurchasesAdminController {
  constructor(private readonly service: PurchasesAdminService) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.service.findAll(pageNumber(page));
  }

  @Get('form-options')
  formOptions() {
    return this.service.formOptions();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: PurchaseDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: PurchaseDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Purchase deleted successfully.' };
  }

  @Post(':id/complete')
  complete(@Param('id', ParseIntPipe) id: number) {
    return this.service.complete(id);
  }

  @Post(':id/payments')
  addPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PurchasePaymentDto,
  ) {
    return this.service.addPayment(id, dto);
  }

  @Post(':id/costs')
  addCost(@Param('id', ParseIntPipe) id: number, @Body() dto: PurchaseCostDto) {
    return this.service.addCost(id, dto);
  }

  @Delete(':id/costs/:costId')
  removeCost(
    @Param('id', ParseIntPipe) id: number,
    @Param('costId', ParseIntPipe) costId: number,
  ) {
    return this.service.removeCost(id, costId);
  }
}

@Controller('api/v1/admin/investments')
@UseGuards(AdminJwtGuard)
export class InvestmentsAdminController {
  constructor(private readonly service: InvestmentsAdminService) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.service.findAll(pageNumber(page));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: InvestmentDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: InvestmentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Investment deleted successfully.' };
  }
}
