import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PlaceOrderService } from '../checkout/place-order.service.js';
import type { Customer } from '../customers/customer.entity.js';
import { OrderItem } from '../orders/order-item.entity.js';
import { Order } from '../orders/order.entity.js';
import { ProductVariant } from '../products/product-variant.entity.js';
import { Product } from '../products/product.entity.js';
import { SslcommerzService } from './sslcommerz.service.js';

const unprocessable = (message: string) =>
  new UnprocessableEntityException({ message });

/** Port of Api\V1\PaymentController + Frontend\PaymentController (SSLCommerz). */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly gateway: SslcommerzService,
    private readonly placeOrder: PlaceOrderService,
  ) {}

  private storefront() {
    return (
      process.env.STOREFRONT_URL ??
      process.env.APP_URL ??
      'https://barakahly.com'
    ).replace(/\/+$/, '');
  }

  async init(customer: Customer, orderId: number) {
    const order = await this.dataSource
      .getRepository(Order)
      .findOne({ where: { id: orderId }, relations: { customer: true } });
    if (!order) throw new NotFoundException({ message: 'Order not found.' });
    if (order.customerId !== customer.id)
      throw new ForbiddenException({ message: 'This action is unauthorized.' });
    if (order.paymentStatus === 'paid')
      throw unprocessable('This order has already been paid.');
    if (!this.gateway.isConfigured())
      throw unprocessable(
        'Online payment is not configured yet. Your order has been placed with pending payment.',
      );

    let response;
    try {
      response = await this.gateway.initiate(order, order.customer);
    } catch (error) {
      response = { error: (error as Error).message };
    }
    if (response.status === 'SUCCESS' && response.GatewayPageURL) {
      return { gateway_url: response.GatewayPageURL };
    }
    this.logger.warn(`SSLCommerz initiate failed: ${JSON.stringify(response)}`);
    throw unprocessable(
      'Could not connect to the payment gateway. Please try again or contact support.',
    );
  }

  /** Where a signed pay link should send the visitor: the gateway, or back to the store. */
  async payByLink(orderNumber: string): Promise<string> {
    const order = await this.dataSource
      .getRepository(Order)
      .findOne({ where: { orderNumber }, relations: { customer: true } });
    if (!order || order.orderStatus === 'cancelled')
      return this.redirect('/checkout?payment=invalid');
    if (order.paymentStatus === 'paid') return this.redirect('/track-order');
    if (!this.gateway.isConfigured())
      return this.redirect('/checkout?payment=failed');
    try {
      const response = await this.gateway.initiate(order, order.customer);
      if (response.status === 'SUCCESS' && response.GatewayPageURL)
        return response.GatewayPageURL;
      this.logger.warn(
        `SSLCommerz initiate failed: ${JSON.stringify(response)}`,
      );
    } catch (error) {
      this.logger.warn(
        `SSLCommerz initiate error: ${(error as Error).message}`,
      );
    }
    return this.redirect('/checkout?payment=failed');
  }

  /** success/ipn: validate with SSLCommerz and mark the order paid. */
  async confirm(tranId?: string, valId?: string): Promise<Order | null> {
    if (!tranId || !valId) return null;
    const repo = this.dataSource.getRepository(Order);
    const order = await repo.findOne({
      where: { orderNumber: tranId },
      relations: { customer: true },
    });
    if (!order) return null;
    if (order.paymentStatus === 'paid') return order;

    let result;
    try {
      result = await this.gateway.validate(valId);
    } catch (error) {
      this.logger.warn(
        `SSLCommerz validation error: ${(error as Error).message}`,
      );
      return null;
    }

    // Beyond Laravel: the validated payment must be for this order, in full.
    const valid =
      (result.status === 'VALID' || result.status === 'VALIDATED') &&
      result.tran_id === order.orderNumber &&
      (result.currency ?? 'BDT') === 'BDT' &&
      Number(result.amount) + 0.01 >= Number(order.totalAmount);
    if (!valid) {
      this.logger.warn(
        `SSLCommerz validation failed: ${JSON.stringify(result)}`,
      );
      return null;
    }

    // Conditional update, so the success redirect and the IPN racing each
    // other only send the notifications once.
    const update = await repo
      .createQueryBuilder()
      .update(Order)
      .set({
        paymentStatus: 'paid',
        paymentGateway: 'sslcommerz',
        transactionId: String(result.tran_id ?? order.orderNumber),
        gatewayValId: result.val_id ? String(result.val_id) : valId,
        gatewayResponse: () => ':response',
        updatedAt: new Date(),
      })
      .where('id = :id', { id: order.id })
      .andWhere("payment_status <> 'paid'")
      .setParameter('response', JSON.stringify(result))
      .execute();
    if (update.affected) {
      order.paymentStatus = 'paid';
      void this.placeOrder.sendOrderPlacedNotifications(order);
    }
    return order;
  }

  /** fail/cancel: mark failed and put the stock back, once. */
  async abandon(tranId?: string) {
    if (!tranId) return;
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOneBy(Order, { orderNumber: tranId });
      if (!order) return;
      const update = await manager
        .createQueryBuilder()
        .update(Order)
        .set({ paymentStatus: 'failed', updatedAt: new Date() })
        .where('id = :id', { id: order.id })
        .andWhere("payment_status = 'pending'")
        .execute();
      if (!update.affected) return;

      const items = await manager.findBy(OrderItem, { orderId: order.id });
      for (const item of items) {
        if (!item.productId) continue;
        const variantId = item.productVariantId;
        await manager.increment(
          variantId ? ProductVariant : Product,
          { id: variantId ?? item.productId },
          'stock',
          item.quantity,
        );
      }
    });
  }

  redirect(path: string) {
    return `${this.storefront()}${path}`;
  }
}
