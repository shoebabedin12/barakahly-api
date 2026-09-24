import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentMethod } from '../payment-methods/payment-method.entity.js';
import { ShippingZone } from '../shipping-zones/shipping-zone.entity.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentMethod, ShippingZone])],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
