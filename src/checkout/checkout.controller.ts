import { Controller, Get } from '@nestjs/common';
import { CheckoutService } from './checkout.service.js';

/**
 * Mirrors Laravel's Api\V1\CheckoutController@options route
 * (GET /api/v1/checkout/options) so the Next.js storefront can be pointed
 * at this service for this one route without any frontend changes.
 */
@Controller('api/v1/checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get('options')
  getOptions() {
    return this.checkoutService.getOptions();
  }
}
