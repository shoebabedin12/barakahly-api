import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../products/product.entity.js';
import type { OrderListQuery } from './dto/order-query.dto.js';
import { OrderItem } from './order-item.entity.js';
import { OrderStatusHistory } from './order-status-history.entity.js';
import { Order } from './order.entity.js';

const PER_PAGE = 15;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private readonly statusHistories: Repository<OrderStatusHistory>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: OrderListQuery) {
    const page = query.page ?? 1;

    const qb = this.orders
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoinAndSelect('order.paymentMethodRef', 'paymentMethodRef')
      .leftJoinAndSelect('order.shippingZone', 'shippingZone')
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * PER_PAGE)
      .take(PER_PAGE);

    if (query.status) {
      qb.andWhere('order.orderStatus = :status', { status: query.status });
    }
    if (query.paymentStatus) {
      qb.andWhere('order.paymentStatus = :paymentStatus', { paymentStatus: query.paymentStatus });
    }
    if (query.search) {
      qb.andWhere(
        `(order.orderNumber LIKE :search OR order.couponCode LIKE :search OR order.transactionId LIKE :search
          OR customer.name LIKE :search OR customer.phone LIKE :search OR customer.email LIKE :search)`,
        { search: `%${query.search}%` },
      );
    }
    if (query.dateFrom) {
      qb.andWhere('DATE(order.createdAt) >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('DATE(order.createdAt) <= :dateTo', { dateTo: query.dateTo });
    }

    const [data, total] = await qb.getManyAndCount();

    const orderStats = await this.getStats();

    return {
      data,
      meta: { page, perPage: PER_PAGE, total, lastPage: Math.max(1, Math.ceil(total / PER_PAGE)) },
      stats: orderStats,
    };
  }

  private async getStats() {
    const [total, pending, processing, shipped, delivered, cancelled] = await Promise.all([
      this.orders.count(),
      this.orders.count({ where: { orderStatus: 'pending' } }),
      this.orders.count({ where: { orderStatus: 'processing' } }),
      this.orders.count({ where: { orderStatus: 'shipped' } }),
      this.orders.count({ where: { orderStatus: 'delivered' } }),
      this.orders.count({ where: { orderStatus: 'cancelled' } }),
    ]);

    const [{ today }] = await this.orders.manager.query(
      "SELECT COUNT(*) as today FROM orders WHERE DATE(created_at) = CURDATE()",
    );
    const [{ this_month: thisMonth }] = await this.orders.manager.query(
      'SELECT COUNT(*) as this_month FROM orders WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())',
    );
    const [{ revenue }] = await this.orders.manager.query(
      "SELECT COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE payment_status = 'paid'",
    );

    return {
      total,
      pending,
      processing,
      shipped,
      delivered,
      cancelled,
      today: Number(today),
      thisMonth: Number(thisMonth),
      revenue: Number(revenue),
    };
  }

  async findOne(id: number) {
    const order = await this.orders.findOne({
      where: { id },
      relations: {
        customer: true,
        paymentMethodRef: true,
        shippingZone: true,
        statusHistories: true,
        items: { product: { images: true }, variant: true },
      },
    });
    if (!order) throw new NotFoundException('Order not found.');

    let mergeCandidates: Order[] = [];

    if (order.customerId && order.paymentStatus === 'pending' && order.orderStatus !== 'cancelled') {
      mergeCandidates = await this.orders.find({
        where: { customerId: order.customerId, paymentStatus: 'pending' },
      });
      mergeCandidates = mergeCandidates.filter((o) => o.id !== order.id && o.orderStatus !== 'cancelled');
    }

    return { order, mergeCandidates };
  }

  async updateStatus(id: number, newStatus: Order['orderStatus']) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found.');

    await this.dataSource.transaction((manager) => this.applyStatusChange(manager, order, newStatus));

    return this.findOne(id);
  }

  async bulkUpdateStatus(ids: number[], newStatus: Order['orderStatus']) {
    const targets = await this.orders.find({ where: {} });
    const matched = targets.filter((o) => ids.includes(o.id));

    await this.dataSource.transaction(async (manager) => {
      for (const order of matched) {
        await this.applyStatusChange(manager, order, newStatus);
      }
    });

    return { updated: matched.length };
  }

  /** Mirrors OrderController::applyStatusChange() exactly, including that
   * stock is always restored on the base Product (never the variant),
   * even for items originally sold as a variant - that's how Laravel
   * does it, so this keeps parity rather than "fixing" it silently. */
  private async applyStatusChange(
    manager: import('typeorm').EntityManager,
    order: Order,
    newStatus: Order['orderStatus'],
  ) {
    const oldStatus = order.orderStatus;

    if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
      const items = await manager.find(OrderItem, { where: { orderId: order.id } });
      for (const item of items) {
        if (item.productId) {
          await manager.increment(Product, { id: item.productId }, 'stock', item.quantity);
        }
      }
    }

    await manager.save(
      manager.create(OrderStatusHistory, { orderId: order.id, status: newStatus, createdAt: new Date() }),
    );

    await manager.update(Order, order.id, { orderStatus: newStatus });
  }

  async updatePaymentStatus(id: number, newStatus: Order['paymentStatus']) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found.');

    await this.orders.update(id, { paymentStatus: newStatus });
    return this.findOne(id);
  }

  async removeShippingCharge(id: number) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found.');

    const newTotal = Number(order.totalAmount) - Number(order.shippingCharge);
    await this.orders.update(id, { totalAmount: String(newTotal), shippingCharge: '0.00' });

    return this.findOne(id);
  }

  async merge(orderId: number, mergeOrderId: number) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');

    const secondary = await this.orders.findOne({ where: { id: mergeOrderId } });
    if (!secondary) throw new NotFoundException('Order to merge not found.');

    if (secondary.id === order.id) {
      throw new BadRequestException('Cannot merge an order with itself.');
    }
    if (secondary.customerId !== order.customerId) {
      throw new BadRequestException('Can only merge orders placed by the same customer.');
    }
    if (order.paymentStatus !== 'pending' || secondary.paymentStatus !== 'pending') {
      throw new BadRequestException('Only unpaid orders can be merged.');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(OrderItem, { orderId: secondary.id }, { orderId: order.id });

      const newSubtotal = await manager
        .createQueryBuilder(OrderItem, 'item')
        .select('COALESCE(SUM(item.subtotal), 0)', 'sum')
        .where('item.orderId = :orderId', { orderId: order.id })
        .getRawOne<{ sum: string }>();

      const subtotal = Number(newSubtotal?.sum ?? 0);

      await manager.update(Order, order.id, {
        subtotal: String(subtotal),
        totalAmount: String(subtotal - Number(order.discountAmount) + Number(order.shippingCharge)),
      });

      await manager.update(Order, secondary.id, {
        orderStatus: 'cancelled',
        subtotal: '0.00',
        shippingCharge: '0.00',
        totalAmount: '0.00',
        shippingAddress: `${secondary.shippingAddress}\n\n[Merged into order ${order.orderNumber}]`,
      });
    });

    return this.findOne(orderId);
  }
}
