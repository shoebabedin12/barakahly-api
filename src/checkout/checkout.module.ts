import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from '../account/account.module.js';
import { CartModule } from '../cart/cart.module.js';
import { Coupon } from '../coupons/coupon.entity.js';
import { CustomerTokensModule } from '../customer-auth/customer-tokens.module.js';
import { MailModule } from '../mail/mail.module.js';
import { PaymentMethod } from '../payment-methods/payment-method.entity.js';
import { Setting } from '../settings/setting.entity.js';
import { ShippingZone } from '../shipping-zones/shipping-zone.entity.js';
import { AbandonedCart } from './abandoned-cart.entity.js';
import { CheckoutOtp } from './checkout-otp.entity.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';
import { PlaceOrderService } from './place-order.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentMethod,
      ShippingZone,
      CheckoutOtp,
      AbandonedCart,
      Coupon,
      Setting,
    ]),
    CartModule,
    CustomerTokensModule,
    AccountModule,
    MailModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService, PlaceOrderService],
})
export class CheckoutModule {}
