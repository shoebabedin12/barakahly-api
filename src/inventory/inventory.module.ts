import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { Investment } from '../investments/investment.entity.js';
import { Product } from '../products/product.entity.js';
import { PurchaseCost } from '../purchases/purchase-cost.entity.js';
import { PurchaseItem } from '../purchases/purchase-item.entity.js';
import { Purchase } from '../purchases/purchase.entity.js';
import { SupplierPayment } from '../suppliers/supplier-payment.entity.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import {
  InvestmentsAdminController,
  PurchasesAdminController,
  SuppliersAdminController,
} from './inventory.controllers.js';
import {
  InvestmentsAdminService,
  PurchasesAdminService,
  SuppliersAdminService,
} from './inventory.services.js';

/** Admin inventory: suppliers (and their payments), purchases (stock in, landed cost) and investments. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supplier,
      SupplierPayment,
      Purchase,
      PurchaseItem,
      PurchaseCost,
      Investment,
      Product,
    ]),
    AdminAuthModule,
  ],
  controllers: [
    SuppliersAdminController,
    PurchasesAdminController,
    InvestmentsAdminController,
  ],
  providers: [
    SuppliersAdminService,
    PurchasesAdminService,
    InvestmentsAdminService,
  ],
})
export class InventoryModule {}
