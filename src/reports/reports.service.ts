import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type SelectQueryBuilder } from 'typeorm';
import { Order } from '../orders/order.entity.js';
import { adminPage } from '../store-admin/admin-page.js';

/** Orders are stored in UTC; the shop runs on Bangladesh time, so days and months are counted in +06:00. */
const LOCAL = (column: string) => `CONVERT_TZ(${column}, '+00:00', '+06:00')`;
const TODAY = "DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+06:00'))";

export interface SalesFilters {
  status?: string;
  paymentStatus?: string;
  customerId?: number;
  couponOnly?: boolean;
  from?: string;
  to?: string;
}

const num = (v: unknown) => Number(v ?? 0);

/** Carbon's format('d M Y') in Dhaka time, e.g. "09 Sep 2026". */
function dayMonthYear(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', day: '2-digit', month: 'short', year: 'numeric' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day} ${parts.month} ${parts.year}`;
}

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** ReportController@index - cards, 30-day chart, status breakdowns and top lists. */
  async overview() {
    const q = <T>(sql: string, params: unknown[] = []) => this.dataSource.query<T>(sql, params);
    const thisMonth = `DATE_FORMAT(${LOCAL('created_at')}, '%Y-%m') = DATE_FORMAT(${TODAY}, '%Y-%m')`;
    const today = `DATE(${LOCAL('created_at')}) = ${TODAY}`;

    const [cards] = await q<Record<string, string | null>[]>(`
      SELECT
        SUM(CASE WHEN ${today} AND order_status = 'delivered' THEN total_amount ELSE 0 END) AS todaySales,
        SUM(CASE WHEN ${today} THEN 1 ELSE 0 END) AS todayOrders,
        SUM(CASE WHEN ${thisMonth} AND order_status = 'delivered' THEN total_amount ELSE 0 END) AS monthlyRevenue,
        SUM(CASE WHEN ${thisMonth} AND order_status = 'delivered' THEN discount_amount ELSE 0 END) AS monthlyDiscount,
        SUM(CASE WHEN ${thisMonth} AND order_status = 'delivered' THEN shipping_charge ELSE 0 END) AS monthlyShipping,
        SUM(CASE WHEN ${thisMonth} THEN 1 ELSE 0 END) AS monthlyOrders,
        SUM(order_status = 'delivered') AS deliveredOrders,
        SUM(order_status = 'pending') AS pendingOrders,
        SUM(order_status = 'cancelled') AS cancelledOrders,
        AVG(CASE WHEN order_status = 'delivered' THEN total_amount END) AS averageOrderValue
      FROM orders`);

    const [salesChart, orderStatus, paymentStatus, topProducts, topCategories, topCustomers] = await Promise.all([
      // Every order placed in the last 30 days (Laravel's chart counted all statuses too).
      q<{ date: string; total: string; orders: string }[]>(`
        SELECT DATE_FORMAT(DATE(${LOCAL('created_at')}), '%Y-%m-%d') AS date, SUM(total_amount) AS total, COUNT(*) AS orders
          FROM orders
         WHERE DATE(${LOCAL('created_at')}) > DATE_SUB(${TODAY}, INTERVAL 30 DAY)
         GROUP BY date ORDER BY date`),
      q<{ status: string; total: string }[]>(
        'SELECT order_status AS status, COUNT(*) AS total FROM orders GROUP BY order_status ORDER BY total DESC',
      ),
      q<{ status: string; total: string }[]>(
        "SELECT COALESCE(payment_status, 'unknown') AS status, COUNT(*) AS total FROM orders GROUP BY status ORDER BY total DESC",
      ),
      q<{ id: number; name: string; orders: string; units: string; revenue: string }[]>(`
        SELECT p.id, p.name, COUNT(DISTINCT oi.order_id) AS orders, SUM(oi.quantity) AS units, SUM(oi.subtotal) AS revenue
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id AND o.order_status <> 'cancelled'
          JOIN products p ON p.id = oi.product_id
         GROUP BY p.id, p.name ORDER BY units DESC, revenue DESC LIMIT 5`),
      q<{ id: number; name: string; products: string }[]>(`
        SELECT c.id, c.name, COUNT(p.id) AS products
          FROM categories c LEFT JOIN products p ON p.category_id = c.id
         GROUP BY c.id, c.name ORDER BY products DESC LIMIT 5`),
      q<{ id: number; name: string; phone: string; orders: string; spent: string }[]>(`
        SELECT c.id, c.name, c.phone, COUNT(o.id) AS orders, SUM(o.total_amount) AS spent
          FROM customers c JOIN orders o ON o.customer_id = c.id AND o.order_status <> 'cancelled'
         GROUP BY c.id, c.name, c.phone ORDER BY spent DESC LIMIT 5`),
    ]);

    const monthlyRevenue = num(cards.monthlyRevenue);
    const monthlyDiscount = num(cards.monthlyDiscount);
    return {
      cards: {
        todaySales: num(cards.todaySales),
        todayOrders: num(cards.todayOrders),
        monthlyRevenue,
        monthlyOrders: num(cards.monthlyOrders),
        deliveredOrders: num(cards.deliveredOrders),
        pendingOrders: num(cards.pendingOrders),
        cancelledOrders: num(cards.cancelledOrders),
        averageOrderValue: Math.round(num(cards.averageOrderValue) * 100) / 100,
        monthlyDiscount,
        monthlyShipping: num(cards.monthlyShipping),
        // Delivered totals already have the discount taken off; this is revenue before shipping.
        monthlyNetRevenue: Math.round((monthlyRevenue - num(cards.monthlyShipping)) * 100) / 100,
      },
      salesChart: salesChart.map((d) => ({ date: d.date, total: num(d.total), orders: num(d.orders) })),
      orderStatus: orderStatus.map((s) => ({ status: s.status, total: num(s.total) })),
      paymentStatus: paymentStatus.map((s) => ({ status: s.status, total: num(s.total) })),
      topProducts: topProducts.map((p) => ({ ...p, orders: num(p.orders), units: num(p.units), revenue: num(p.revenue) })),
      topCategories: topCategories.map((c) => ({ ...c, products: num(c.products) })),
      topCustomers: topCustomers.map((c) => ({ ...c, orders: num(c.orders), spent: num(c.spent) })),
    };
  }

  /** ReportController@sales - filtered orders with totals across the whole filter, not just the page. */
  async sales(filters: SalesFilters, page: number) {
    const perPage = 20;
    const [[rows, total], totals] = await Promise.all([
      this.salesQuery(filters)
        .leftJoinAndSelect('o.customer', 'customer')
        .orderBy('o.created_at', 'DESC')
        .addOrderBy('o.id', 'DESC')
        .skip((page - 1) * perPage)
        .take(perPage)
        .getManyAndCount(),
      this.salesQuery(filters)
        .select('COUNT(*)', 'orders')
        .addSelect('COALESCE(SUM(o.subtotal), 0)', 'subtotal')
        .addSelect('COALESCE(SUM(o.discount_amount), 0)', 'discount')
        .addSelect('COALESCE(SUM(o.shipping_charge), 0)', 'shipping')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'sales')
        .addSelect('COALESCE(AVG(o.total_amount), 0)', 'average')
        .getRawOne<Record<string, string>>(),
    ]);
    return {
      ...adminPage(rows.map((o) => this.row(o)), total, page, perPage),
      totals: {
        orders: num(totals?.orders),
        subtotal: num(totals?.subtotal),
        discount: num(totals?.discount),
        shipping: num(totals?.shipping),
        sales: num(totals?.sales),
        average: Math.round(num(totals?.average) * 100) / 100,
      },
    };
  }

  /** SalesReportExport, as CSV (opens in Excel). */
  async salesCsv(filters: SalesFilters) {
    const orders = await this.salesQuery(filters)
      .leftJoinAndSelect('o.customer', 'customer')
      .orderBy('o.created_at', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .getMany();
    const cell = (v: string | number | null | undefined) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      'Date,Order Number,Customer,Phone,Subtotal,Discount,Shipping,Grand Total,Payment Status,Order Status',
      ...orders.map((o) =>
        [
          dayMonthYear(o.createdAt),
          o.orderNumber,
          o.customer?.name ?? 'Guest',
          o.customer?.phone ?? '',
          o.subtotal,
          o.discountAmount,
          o.shippingCharge,
          o.totalAmount,
          o.paymentStatus,
          o.orderStatus,
        ]
          .map(cell)
          .join(','),
      ),
    ];
    return '﻿' + lines.join('\r\n');
  }

  private row(o: Order) {
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt,
      customer: o.customer ? { id: o.customer.id, name: o.customer.name, phone: o.customer.phone } : null,
      subtotal: o.subtotal,
      discountAmount: o.discountAmount,
      shippingCharge: o.shippingCharge,
      totalAmount: o.totalAmount,
      paymentStatus: o.paymentStatus,
      orderStatus: o.orderStatus,
    };
  }

  private salesQuery(f: SalesFilters): SelectQueryBuilder<Order> {
    const query = this.dataSource.getRepository(Order).createQueryBuilder('o');
    if (f.status) query.andWhere('o.order_status = :status', { status: f.status });
    if (f.paymentStatus) query.andWhere('o.payment_status = :paymentStatus', { paymentStatus: f.paymentStatus });
    if (f.customerId) query.andWhere('o.customer_id = :customerId', { customerId: f.customerId });
    if (f.couponOnly) query.andWhere('o.coupon_id IS NOT NULL');
    if (f.from) query.andWhere(`DATE(${LOCAL('o.created_at')}) >= :from`, { from: f.from });
    if (f.to) query.andWhere(`DATE(${LOCAL('o.created_at')}) <= :to`, { to: f.to });
    return query;
  }
}
