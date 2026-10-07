import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { resolveCartOwner } from '../cart/cart.service.js';
import {
  type CustomerRequest,
  OptionalCustomerGuard,
} from '../customer-auth/customer-auth.guard.js';
import { CheckoutService } from './checkout.service.js';
import {
  ApplyCouponDto,
  PlaceOrderDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/checkout.dto.js';
import { PlaceOrderService } from './place-order.service.js';

/** Mirrors Api\V1\CheckoutController: options, guest email OTP, coupons, placing the order. */
@Controller('api/v1')
export class CheckoutController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly placeOrderService: PlaceOrderService,
  ) {}

  @Get('checkout/options')
  getOptions() {
    return this.checkoutService.getOptions();
  }

  @Post('checkout/send-otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.placeOrderService.sendOtp(dto.email);
  }

  @Post('checkout/verify-otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(OptionalCustomerGuard)
  verifyOtp(@Req() request: CustomerRequest, @Body() dto: VerifyOtpDto) {
    return this.placeOrderService.verifyOtp(
      resolveCartOwner(request),
      dto.email,
      dto.code,
    );
  }

  @Post('coupon/apply')
  @HttpCode(200)
  @UseGuards(OptionalCustomerGuard)
  applyCoupon(@Req() request: CustomerRequest, @Body() dto: ApplyCouponDto) {
    return this.placeOrderService.applyCoupon(
      resolveCartOwner(request),
      dto.coupon_code,
    );
  }

  @Post('checkout')
  @HttpCode(201)
  @UseGuards(OptionalCustomerGuard)
  placeOrder(@Req() request: CustomerRequest, @Body() dto: PlaceOrderDto) {
    return this.placeOrderService.placeOrder(
      resolveCartOwner(request),
      request.customer,
      dto,
    );
  }
}
