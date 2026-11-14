import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ActivityLogService } from '../activity-log/activity-log.service.js';
import { Customer } from '../customers/customer.entity.js';
import { PaymentMethod } from '../payment-methods/payment-method.entity.js';
import { payLinkUrl } from '../payments/pay-link.js';
import { ProductVariant } from '../products/product-variant.entity.js';
import { ShippingZone } from '../shipping-zones/shipping-zone.entity.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
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
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private readonly statusHistories: Repository<OrderStatusHistory>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly activity: ActivityLogService,
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
      qb.andWhere('order.paymentStatus = :paymentStatus', {
        paymentStatus: query.paymentStatus,
      });
    }
    if (query.search) {
      qb.andWhere(
        `(order.orderNumber LIKE :search OR order.couponCode LIKE :search OR order.transactionId LIKE :search
          OR customer.name LIKE :search OR customer.phone LIKE :search OR customer.email LIKE :search)`,
        { search: `%${query.search}%` },
      );
    }
    if (query.dateFrom) {
      qb.andWhere('DATE(order.createdAt) >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    }
    if (query.dateTo) {
      qb.andWhere('DATE(order.createdAt) <= :dateTo', { dateTo: query.dateTo });
    }

    const [data, total] = await qb.getManyAndCount();

    const orderStats = await this.getStats();

    return {
      data,
      meta: {
        page,
        perPage: PER_PAGE,
        total,
        lastPage: Math.max(1, Math.ceil(total / PER_PAGE)),
      },
      stats: orderStats,
    };
  }

  private async getStats() {
    const [total, pending, processing, shipped, delivered, cancelled] =
      await Promise.all([
        this.orders.count(),
        this.orders.count({ where: { orderStatus: 'pending' } }),
        this.orders.count({ where: { orderStatus: 'processing' } }),
        this.orders.count({ where: { orderStatus: 'shipped' } }),
        this.orders.count({ where: { orderStatus: 'delivered' } }),
        this.orders.count({ where: { orderStatus: 'cancelled' } }),
      ]);

    const [{ today }] = await this.orders.manager.query(
      'SELECT COUNT(*) as today FROM orders WHERE DATE(created_at) = CURDATE()',
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

    if (
      order.customerId &&
      order.paymentStatus === 'pending' &&
      order.orderStatus !== 'cancelled'
    ) {
      mergeCandidates = await this.orders.find({
        where: { customerId: order.customerId, paymentStatus: 'pending' },
      });
      mergeCandidates = mergeCandidates.filter(
        (o) => o.id !== order.id && o.orderStatus !== 'cancelled',
      );
    }

    // Orders created in the panel with online payment get a link to send the customer.
    const payLink =
      order.paymentGateway === 'sslcommerz' &&
      order.paymentStatus !== 'paid' &&
      order.orderStatus !== 'cancelled'
        ? payLinkUrl(order.orderNumber)
        : null;

    return { order, mergeCandidates, payLink };
  }

  /** What the "Create order" form needs: active products with their variants, methods, zones. */
  async createOptions() {
    const [products, paymentMethods, shippingZones] = await Promise.all([
      this.products.find({
        where: { status: true },
        relations: { variants: { color: true, size: true } },
        order: { name: 'ASC' },
      }),
      this.dataSource
        .getRepository(PaymentMethod)
        .find({
          where: { status: true },
          order: { sortOrder: 'ASC', id: 'ASC' },
        }),
      this.dataSource
        .getRepository(ShippingZone)
        .find({ where: { status: true }, order: { id: 'ASC' } }),
    ]);
    return {
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: Number(product.discountPrice ?? product.price),
        stock: product.stock,
        variants: (product.variants ?? [])
          .filter((variant) => variant.status)
          .map((variant) => ({
            id: variant.id,
            label:
              [variant.color?.name, variant.size?.name]
                .filter(Boolean)
                .join(' / ') ||
              variant.sku ||
              `Variant ${variant.id}`,
            price: Number(
              variant.discountPrice ??
                variant.price ??
                product.discountPrice ??
                product.price,
            ),
            stock: variant.stock,
          })),
      })),
      paymentMethods: paymentMethods.map((m) => ({
        id: m.id,
        name: m.name,
        code: m.code,
      })),
      shippingZones: shippingZones.map((z) => ({
        id: z.id,
        name: z.name,
        charge: Number(z.charge),
      })),
    };
  }

  /**
   * Admin\OrderController@store: an order taken over the phone/WhatsApp. Finds
   * or creates the customer by phone (an existing account's name and email are
   * left alone), takes stock exactly like checkout does - variant-aware and
   * never below zero - and logs it.
   */
  async createCustom(dto: CreateOrderDto) {
    const unprocessable = (message: string) =>
      new UnprocessableEntityException({ message });

    const paymentMethod = await this.dataSource
      .getRepository(PaymentMethod)
      .findOneBy({ id: dto.paymentMethodId });
    if (!paymentMethod) throw unprocessable('Please choose a payment method.');

    const zone = dto.shippingZoneId
      ? await this.dataSource
          .getRepository(ShippingZone)
          .findOneBy({ id: dto.shippingZoneId })
      : null;
    if (dto.shippingZoneId && !zone)
      throw unprocessable('Please choose a valid shipping zone.');
    const shipping = dto.shippingCharge ?? (zone ? Number(zone.charge) : 0);

    const orderId = await this.dataSource.transaction(async (manager) => {
      const lines: {
        product: Product;
        variant: ProductVariant | null;
        quantity: number;
        price: number;
      }[] = [];
      for (const item of dto.items) {
        const product = await manager.findOneBy(Product, {
          id: item.productId,
        });
        if (!product)
          throw unprocessable('A selected product no longer exists.');
        const variant = item.variantId
          ? await manager.findOne(ProductVariant, {
              where: { id: item.variantId, productId: product.id },
              relations: { color: true, size: true },
            })
          : null;
        if (item.variantId && !variant)
          throw unprocessable(
            `Please choose a valid option for ${product.name}.`,
          );
        lines.push({
          product,
          variant,
          quantity: item.quantity,
          price: item.price,
        });
      }

      const phone = dto.customerPhone.trim();
      let customer = await manager.findOneBy(Customer, { phone });
      if (customer) {
        if (!customer.address)
          await manager.update(Customer, customer.id, {
            address: dto.shippingAddress,
          });
      } else {
        // customers.email is unique: keep the email off if another account already uses it.
        const email = dto.customerEmail?.trim() || null;
        const emailTaken = email
          ? await manager.existsBy(Customer, { email })
          : false;
        customer = await manager.save(
          manager.create(Customer, {
            name: dto.customerName.trim(),
            phone,
            email: emailTaken ? null : email,
            address: dto.shippingAddress,
            status: true,
          }),
        );
      }

      const subtotal = lines.reduce(
        (sum, line) => sum + line.price * line.quantity,
        0,
      );
      const base = `ORD-${Math.floor(Date.now() / 1000)}`;
      let orderNumber = base;
      for (let n = 2; await manager.existsBy(Order, { orderNumber }); n++)
        orderNumber = `${base}-${n}`;

      const notes = dto.notes?.trim();
      const order = await manager.save(
        manager.create(Order, {
          customerId: customer.id,
          orderNumber,
          shippingZoneId: zone?.id ?? null,
          subtotal: subtotal.toFixed(2),
          shippingCharge: shipping.toFixed(2),
          discountAmount: '0.00',
          totalAmount: (subtotal + shipping).toFixed(2),
          paymentMethodId: paymentMethod.id,
          paymentMethod: paymentMethod.name,
          paymentGateway: paymentMethod.code,
          paymentStatus: 'pending',
          orderStatus: 'pending',
          shippingAddress:
            dto.shippingAddress + (notes ? `\n\nNote: ${notes}` : ''),
        }),
      );

      for (const line of lines) {
        await manager.save(
          manager.create(OrderItem, {
            orderId: order.id,
            productId: line.product.id,
            productVariantId: line.variant?.id ?? null,
            productName: line.product.name,
            variantColor: line.variant?.color?.name ?? null,
            variantSize: line.variant?.size?.name ?? null,
            price: line.price.toFixed(2),
            quantity: line.quantity,
            subtotal: (line.price * line.quantity).toFixed(2),
          }),
        );
        const result = await manager
          .createQueryBuilder()
          .update(line.variant ? ProductVariant : Product)
          .set({ stock: () => `stock - ${Number(line.quantity)}` })
          .where('id = :id', { id: line.variant?.id ?? line.product.id })
          .andWhere('stock >= :quantity', { quantity: line.quantity })
          .execute();
        if (!result.affected)
          throw unprocessable(
            `${line.product.name} does not have enough stock.`,
          );
      }

      await manager.save(
        manager.create(OrderStatusHistory, {
          orderId: order.id,
          status: 'pending',
          createdAt: new Date(),
        }),
      );
      return order.id;
    });

    const created = await this.orders.findOneByOrFail({ id: orderId });
    await this.activity.record(
      'created',
      { model: 'Order', id: created.id, label: created.orderNumber },
      `Created custom order ${created.orderNumber}`,
    );
    return this.findOne(orderId);
  }

  async updateStatus(id: number, newStatus: Order['orderStatus']) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found.');

    await this.dataSource.transaction((manager) =>
      this.applyStatusChange(manager, order, newStatus),
    );
    await this.recordStatusChange(order, newStatus);

    return this.findOne(id);
  }

  async bulkUpdateStatus(ids: number[], newStatus: Order['orderStatus']) {
    const matched = ids.length
      ? await this.orders.find({ where: { id: In(ids) } })
      : [];

    await this.dataSource.transaction(async (manager) => {
      for (const order of matched) {
        await this.applyStatusChange(manager, order, newStatus);
      }
    });
    for (const order of matched)
      await this.recordStatusChange(order, newStatus);

    return { updated: matched.length };
  }

  private recordStatusChange(order: Order, newStatus: Order['orderStatus']) {
    return this.activity.record(
      'status_changed',
      { model: 'Order', id: order.id, label: order.orderNumber },
      `Changed order ${order.orderNumber} status from "${order.orderStatus}" to "${newStatus}"`,
    );
  }

  /** OrderController::applyStatusChange(). Cancelling puts the stock back
   * where checkout took it from - the variant for variant lines (Laravel
   * always restored the base product, leaving variant stock short). */
  private async applyStatusChange(
    manager: import('typeorm').EntityManager,
    order: Order,
    newStatus: Order['orderStatus'],
  ) {
    const oldStatus = order.orderStatus;

    if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
      const items = await manager.find(OrderItem, {
        where: { orderId: order.id },
      });
      for (const item of items) {
        if (item.productVariantId) {
          await manager.increment(
            ProductVariant,
            { id: item.productVariantId },
            'stock',
            item.quantity,
          );
        } else if (item.productId) {
          await manager.increment(
            Product,
            { id: item.productId },
            'stock',
            item.quantity,
          );
        }
      }
    }

    await manager.save(
      manager.create(OrderStatusHistory, {
        orderId: order.id,
        status: newStatus,
        createdAt: new Date(),
      }),
    );

    await manager.update(Order, order.id, { orderStatus: newStatus });
  }

  async updatePaymentStatus(id: number, newStatus: Order['paymentStatus']) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found.');

    await this.orders.update(id, { paymentStatus: newStatus });
    await this.activity.record(
      'payment_status_changed',
      { model: 'Order', id: order.id, label: order.orderNumber },
      `Changed order ${order.orderNumber} payment status from "${order.paymentStatus}" to "${newStatus}"`,
    );
    return this.findOne(id);
  }

  async removeShippingCharge(id: number) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found.');

    const newTotal = Number(order.totalAmount) - Number(order.shippingCharge);
    await this.orders.update(id, {
      totalAmount: String(newTotal),
      shippingCharge: '0.00',
    });
    await this.activity.record(
      'shipping_charge_removed',
      { model: 'Order', id: order.id, label: order.orderNumber },
      `Removed ৳${order.shippingCharge} delivery charge from order ${order.orderNumber}`,
    );

    return this.findOne(id);
  }

  async merge(orderId: number, mergeOrderId: number) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');

    const secondary = await this.orders.findOne({
      where: { id: mergeOrderId },
    });
    if (!secondary) throw new NotFoundException('Order to merge not found.');

    if (secondary.id === order.id) {
      throw new BadRequestException('Cannot merge an order with itself.');
    }
    if (secondary.customerId !== order.customerId) {
      throw new BadRequestException(
        'Can only merge orders placed by the same customer.',
      );
    }
    if (
      order.paymentStatus !== 'pending' ||
      secondary.paymentStatus !== 'pending'
    ) {
      throw new BadRequestException('Only unpaid orders can be merged.');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        OrderItem,
        { orderId: secondary.id },
        { orderId: order.id },
      );

      const newSubtotal = await manager
        .createQueryBuilder(OrderItem, 'item')
        .select('COALESCE(SUM(item.subtotal), 0)', 'sum')
        .where('item.orderId = :orderId', { orderId: order.id })
        .getRawOne<{ sum: string }>();

      const subtotal = Number(newSubtotal?.sum ?? 0);

      await manager.update(Order, order.id, {
        subtotal: String(subtotal),
        totalAmount: String(
          subtotal -
            Number(order.discountAmount) +
            Number(order.shippingCharge),
        ),
      });

      await manager.update(Order, secondary.id, {
        orderStatus: 'cancelled',
        subtotal: '0.00',
        shippingCharge: '0.00',
        totalAmount: '0.00',
        shippingAddress: `${secondary.shippingAddress}\n\n[Merged into order ${order.orderNumber}]`,
      });
    });

    await this.activity.record(
      'merged',
      { model: 'Order', id: order.id, label: order.orderNumber },
      `Merged order ${secondary.orderNumber} into order ${order.orderNumber}`,
    );
    return this.findOne(orderId);
  }
}
