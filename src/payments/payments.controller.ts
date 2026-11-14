import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  CurrentCustomer,
  CustomerAuthGuard,
} from '../customer-auth/customer-auth.guard.js';
import type { Customer } from '../customers/customer.entity.js';
import { verifyPayLink } from './pay-link.js';
import { PaymentsService } from './payments.service.js';

interface GatewayPost {
  tran_id?: string;
  val_id?: string;
}

/**
 * SSLCommerz. `init` is called by the storefront for the signed-in customer;
 * the other four are posted to by the gateway itself (form-encoded, no auth),
 * so nothing they say is trusted until the validation API confirms it.
 */
@Controller('api/v1/payment/sslcommerz')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('init/:order')
  @UseGuards(CustomerAuthGuard)
  init(
    @CurrentCustomer() customer: Customer,
    @Param('order', ParseIntPipe) orderId: number,
  ) {
    return this.payments.init(customer, orderId);
  }

  /** The signed link the admin sends for an order created in the panel. */
  @Get('pay/:orderNumber')
  async pay(
    @Param('orderNumber') orderNumber: string,
    @Query('sig') sig: string | undefined,
    @Res() res: Response,
  ) {
    if (!verifyPayLink(orderNumber, sig)) {
      res.redirect(302, this.payments.redirect('/checkout?payment=invalid'));
      return;
    }
    res.redirect(302, await this.payments.payByLink(orderNumber));
  }

  @Post('success')
  @SkipThrottle()
  async success(@Body() body: GatewayPost, @Res() res: Response) {
    const order = await this.payments.confirm(body.tran_id, body.val_id);
    res.redirect(
      303,
      this.payments.redirect(
        order
          ? `/order-success/${order.id}?payment=success`
          : '/checkout?payment=invalid',
      ),
    );
  }

  @Post('fail')
  @SkipThrottle()
  async fail(@Body() body: GatewayPost, @Res() res: Response) {
    await this.payments.abandon(body.tran_id);
    res.redirect(303, this.payments.redirect('/checkout?payment=failed'));
  }

  @Post('cancel')
  @SkipThrottle()
  async cancel(@Body() body: GatewayPost, @Res() res: Response) {
    await this.payments.abandon(body.tran_id);
    res.redirect(303, this.payments.redirect('/checkout?payment=cancelled'));
  }

  @Post('ipn')
  @HttpCode(200)
  @SkipThrottle()
  async ipn(@Body() body: GatewayPost) {
    await this.payments.confirm(body.tran_id, body.val_id);
    return 'OK';
  }
}
