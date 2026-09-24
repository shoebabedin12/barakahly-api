import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../customers/customer.entity.js';
import { Investment } from '../investments/investment.entity.js';
import { Order } from '../orders/order.entity.js';
import { Product } from '../products/product.entity.js';
import { Purchase } from '../purchases/purchase.entity.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { User } from '../users/user.entity.js';

/** Mirrors Admin\DashboardController@index field for field - see that
 * file's comments for the business rules (esp. the profit formula). */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
    @InjectRepository(Purchase) private readonly purchases: Repository<Purchase>,
    @InjectRepository(Investment) private readonly investments: Repository<Investment>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async getStats() {
    const totalProducts = await this.products.count();
    const activeProducts = await this.products.count({ where: { status: true } });
    const totalSuppliers = await this.suppliers.count();
    const totalCustomers = await this.customers.count();

    const totalPurchaseAmount = await this.sum(Purchase, 'total_amount');
    const totalInvested = await this.sum(Investment, 'amount');
    const investmentUsed = await this.sum(Purchase, 'total_amount', 'investment_id IS NOT NULL');
    const investmentRemaining = totalInvested - investmentUsed;
    const totalFromBusinessFund = await this.sum(
      Purchase,
      'total_amount',
      "funding_source = 'business'",
    );

    const totalOrders = await this.orders.count();
    const pendingOrders = await this.orders.count({ where: { orderStatus: 'pending' } });
    const deliveredOrders = await this.orders.count({ where: { orderStatus: 'delivered' } });
    const pendingPaymentDeliveredOrders = await this.orders.count({
      where: { orderStatus: 'delivered', paymentStatus: 'pending' },
    });
    const pendingPaymentDeliveredAmount = await this.sum(
      Order,
      'total_amount',
      "order_status = 'delivered' AND payment_status = 'pending'",
    );

    const totalSales = await this.sum(Order, 'total_amount', "order_status = 'delivered'");
    const todaySales = await this.sum(
      Order,
      'total_amount',
      "order_status = 'delivered' AND DATE(created_at) = CURDATE()",
    );
    const monthlySales = await this.sum(
      Order,
      'total_amount',
      "order_status = 'delivered' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())",
    );

    const [totalProfit, todayProfit, monthlyProfit] = await Promise.all([
      this.profitFor(),
      this.profitFor('DATE(orders.created_at) = CURDATE()'),
      this.profitFor(
        'MONTH(orders.created_at) = MONTH(CURDATE()) AND YEAR(orders.created_at) = YEAR(CURDATE())',
      ),
    ]);

    const orderStatus = await this.orders.manager.query(
      'SELECT order_status, COUNT(*) as total FROM orders GROUP BY order_status',
    );

    const salesChart = await this.getSalesChart();

    const topProducts = await this.orders.manager.query(`
      SELECT p.name as product_name, p.sku,
        SUM(oi.quantity) as total_sold,
        SUM(oi.subtotal) as revenue
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_sold DESC
      LIMIT 5
    `);

    const lowStockProducts = await this.getLowStockProducts();

    const recentOrders = await this.orders.find({
      relations: { customer: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    // Mirrors the Laravel controller exactly - "recentCustomers" there
    // pulls from the `users` (admin/staff) table, not `customers`.
    const recentCustomers = await this.users.find({
      order: { id: 'DESC' },
      take: 5,
    });

    return {
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      deliveredOrders,
      pendingPaymentDeliveredOrders,
      pendingPaymentDeliveredAmount,
      totalSales,
      todaySales,
      monthlySales,
      totalProfit,
      todayProfit,
      monthlyProfit,
      orderStatus: Object.fromEntries(orderStatus.map((r: { order_status: string; total: string }) => [r.order_status, Number(r.total)])),
      salesChart,
      topProducts: topProducts.map((r: { product_name: string; sku: string; total_sold: string; revenue: string }) => ({
        productName: r.product_name,
        sku: r.sku,
        totalSold: Number(r.total_sold),
        revenue: Number(r.revenue),
      })),
      lowStockProducts,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer?.name ?? null,
        totalAmount: o.totalAmount,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
      totalCustomers,
      recentCustomers: recentCustomers.map((u) => ({ id: u.id, name: u.name, email: u.email })),
      totalSuppliers,
      totalPurchaseAmount,
      totalInvested,
      investmentUsed,
      investmentRemaining,
      totalFromBusinessFund,
    };
  }

  /** SUM(column) over `entity`'s table, with an optional raw SQL WHERE clause. */
  private async sum(
    entity: typeof Purchase | typeof Investment | typeof Order,
    column: string,
    where?: string,
  ): Promise<number> {
    const table = this.orders.manager.getRepository(entity).metadata.tableName;
    const sql = `SELECT COALESCE(SUM(${column}), 0) as total FROM \`${table}\`${where ? ` WHERE ${where}` : ''}`;
    const rows = await this.orders.manager.query(sql);
    return Number(rows[0]?.total ?? 0);
  }

  /** Mirrors the $profitFor closure: delivered order items' subtotal minus
   * each product's average landed cost (0 when no purchase history exists). */
  private async profitFor(dateConstraint?: string): Promise<number> {
    const rows = await this.orders.manager.query(`
      SELECT oi.subtotal, oi.quantity,
        COALESCE((
          SELECT SUM(COALESCE(pi.landed_cost, pi.purchase_price) * pi.quantity) / SUM(pi.quantity)
          FROM purchase_items pi
          WHERE pi.product_id = oi.product_id
        ), 0) as avg_cost
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.order_status = 'delivered'
      ${dateConstraint ? `AND ${dateConstraint.replace(/orders\./g, 'o.')}` : ''}
    `);

    return rows.reduce(
      (sum: number, row: { subtotal: string; quantity: number; avg_cost: string }) =>
        sum + (Number(row.subtotal) - Number(row.avg_cost) * row.quantity),
      0,
    );
  }

  /** Mirrors Product::with('variants')->where(status,true)->get()
   * ->filter(effective_stock <= 5)->sortBy('effective_stock')->take(5). */
  private async getLowStockProducts() {
    const products = await this.products.find({
      where: { status: true },
      relations: { variants: true },
    });

    return products
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        effectiveStock: p.variants.length
          ? p.variants.reduce((sum, v) => sum + v.stock, 0)
          : p.stock,
      }))
      .filter((p) => p.effectiveStock <= 5)
      .sort((a, b) => a.effectiveStock - b.effectiveStock)
      .slice(0, 5);
  }

  /** Mirrors the 30-day loop: one entry per day (zero-filled), oldest first. */
  private async getSalesChart() {
    const rows: { date: string; sales: string }[] = await this.orders.manager.query(`
      SELECT DATE(created_at) as date, SUM(total_amount) as sales
      FROM orders
      WHERE order_status = 'delivered' AND created_at >= CURDATE() - INTERVAL 29 DAY
      GROUP BY DATE(created_at)
    `);

    const byDate = new Map(rows.map((r) => [r.date, Number(r.sales)]));
    const chart: { date: string; sales: number }[] = [];

    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoDate = d.toISOString().slice(0, 10);
      chart.push({
        // Matches PHP Carbon's format('d M') exactly - Intl's 'short'
        // month gives "Sept" (4 letters) for September in some locales.
        date: `${String(d.getDate()).padStart(2, '0')} ${MONTH_ABBR[d.getMonth()]}`,
        sales: byDate.get(isoDate) ?? 0,
      });
    }

    return chart;
  }
}

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
