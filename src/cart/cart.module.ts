import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerTokensModule } from '../customer-auth/customer-tokens.module.js';
import { ProductImage } from '../products/product-image.entity.js';
import { ProductVariant } from '../products/product-variant.entity.js';
import { Product } from '../products/product.entity.js';
import { CartItem } from './cart-item.entity.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CartItem, Product, ProductVariant, ProductImage]),
    CustomerTokensModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
