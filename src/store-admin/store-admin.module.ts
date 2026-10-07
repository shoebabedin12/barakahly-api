import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { Banner } from '../banners/banner.entity.js';
import { Coupon } from '../coupons/coupon.entity.js';
import { Customer } from '../customers/customer.entity.js';
import { Order } from '../orders/order.entity.js';
import { PaymentMethod } from '../payment-methods/payment-method.entity.js';
import { Review } from '../reviews/review.entity.js';
import { Setting } from '../settings/setting.entity.js';
import { ShippingZone } from '../shipping-zones/shipping-zone.entity.js';
import { CustomersAdminService } from './customers-admin.service.js';
import {
  BannersAdminController,
  CouponsAdminController,
  CustomersAdminController,
  PaymentMethodsAdminController,
  ReviewsAdminController,
  SettingsAdminController,
  ShippingZonesAdminController,
} from './store-admin.controllers.js';
import {
  BannersAdminService,
  CouponsAdminService,
  PaymentMethodsAdminService,
  ReviewsAdminService,
  SettingsAdminService,
  ShippingZonesAdminService,
} from './store-admin.services.js';

/** Admin screens for running the shop: customers, coupons, banners, payments, shipping, reviews, settings. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      Order,
      Coupon,
      PaymentMethod,
      ShippingZone,
      Banner,
      Review,
      Setting,
    ]),
    AdminAuthModule,
  ],
  controllers: [
    CustomersAdminController,
    CouponsAdminController,
    PaymentMethodsAdminController,
    ShippingZonesAdminController,
    BannersAdminController,
    ReviewsAdminController,
    SettingsAdminController,
  ],
  providers: [
    CustomersAdminService,
    CouponsAdminService,
    PaymentMethodsAdminService,
    ShippingZonesAdminService,
    BannersAdminService,
    ReviewsAdminService,
    SettingsAdminService,
  ],
})
export class StoreAdminModule {}
