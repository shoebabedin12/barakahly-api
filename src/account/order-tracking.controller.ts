import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AccountService } from './account.service.js';
import { TrackOrderDto } from './dto/track-order.dto.js';

/** Public order tracking for guests: order number + the phone it was placed with. */
@Controller('api/v1')
export class OrderTrackingController {
  constructor(private readonly account: AccountService) {}

  @Post('orders/track')
  @HttpCode(200)
  // Tight limit: the pair is the only secret, so don't let anyone enumerate it.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  track(@Body() dto: TrackOrderDto) {
    return this.account.trackOrder(dto.order_number, dto.phone);
  }
}
