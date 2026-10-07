import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartModule } from '../cart/cart.module.js';
import { Customer } from '../customers/customer.entity.js';
import { Order } from '../orders/order.entity.js';
import { Wishlist } from '../wishlist/wishlist.entity.js';
import { CustomerAuthController } from './customer-auth.controller.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { CustomerTokensModule } from './customer-tokens.module.js';
import { Passkey } from './passkey.entity.js';
import { PasskeysService } from './passkeys.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, Order, Wishlist, Passkey]),
    CustomerTokensModule,
    CartModule,
  ],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, PasskeysService],
  exports: [CustomerAuthService],
})
export class CustomerAuthModule {}
