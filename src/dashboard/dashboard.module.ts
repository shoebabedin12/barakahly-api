import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { Customer } from '../customers/customer.entity.js';
import { Investment } from '../investments/investment.entity.js';
import { Order } from '../orders/order.entity.js';
import { Product } from '../products/product.entity.js';
import { Purchase } from '../purchases/purchase.entity.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { User } from '../users/user.entity.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Order, Customer, Supplier, Purchase, Investment, User]),
    AdminAuthModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
