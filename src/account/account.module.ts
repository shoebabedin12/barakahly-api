import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module.js';
import { CustomerTokensModule } from '../customer-auth/customer-tokens.module.js';
import { OrderItem } from '../orders/order-item.entity.js';
import { Order } from '../orders/order.entity.js';
import { Product } from '../products/product.entity.js';
import { Review } from '../reviews/review.entity.js';
import { Wishlist } from '../wishlist/wishlist.entity.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, Wishlist, Review]),
    CustomerTokensModule,
    CatalogModule,
  ],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
