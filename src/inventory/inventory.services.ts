import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Investment } from '../investments/investment.entity.js';
import { ProductVariant } from '../products/product-variant.entity.js';
import { Product } from '../products/product.entity.js';
import { PurchaseCost } from '../purchases/purchase-cost.entity.js';
import { PurchaseItem } from '../purchases/purchase-item.entity.js';
import { Purchase } from '../purchases/purchase.entity.js';
import { SupplierPayment } from '../suppliers/supplier-payment.entity.js';
import { Supplier } from '../suppliers/supplier.entity.js';
import { adminPage, orNotFound } from '../store-admin/admin-page.js';
import type {
  InvestmentDto,
  PurchaseCostDto,
  PurchaseDto,
  PurchasePaymentDto,
  SupplierDto,
  SupplierPaymentDto,
} from './dto/inventory.dto.js';

/** "Red / XL" style name for a variant. */
const variantLabel = (v: ProductVariant) =>
  [v.color?.name, v.size?.name].filter(Boolean).join(' / ') || v.sku || `Variant #${v.id}`;

const round2 = (n: number) => Math.round(n * 100) / 100;
const fixed = (n: number) => round2(n).toFixed(2);

/** `SUM(column)` per foreign key, as a lookup map. */
async function sumBy(
  repo: Repository<any>,
  key: string,
  column: string,
  ids: number[],
) {
  if (ids.length === 0) return new Map<number, number>();
  const rows: { id: number; total: string | null }[] = await repo
    .createQueryBuilder('t')
    .select(`t.${key}`, 'id')
    .addSelect(`SUM(t.${column})`, 'total')
    .where(`t.${key} IN (:...ids)`, { ids })
    .groupBy(`t.${key}`)
    .getRawMany();
  return new Map(rows.map((r) => [Number(r.id), Number(r.total ?? 0)]));
}

// ---------------------------------------------------------------- suppliers

/**
 * What we owe a supplier. Money reaches them two ways - a payment recorded
 * on a purchase (purchases.paid_amount) or a general supplier payment
 * (supplier_payments) - and both count towards the balance.
 */
function balance(purchased: number, paidOnPurchases: number, paidDirect: number) {
  const totalPaid = round2(paidOnPurchases + paidDirect);
  return {
    totalPurchaseAmount: round2(purchased),
    paidOnPurchases: round2(paidOnPurchases),
    supplierPayments: round2(paidDirect),
    totalPaid,
    totalDue: round2(purchased - totalPaid),
  };
}

@Injectable()
export class SuppliersAdminService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
    @InjectRepository(Purchase)
    private readonly purchases: Repository<Purchase>,
    @InjectRepository(SupplierPayment)
    private readonly payments: Repository<SupplierPayment>,
  ) {}

  async findAll(page: number) {
    const perPage = 20;
    const [rows, total] = await this.suppliers.findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    const ids = rows.map((s) => s.id);
    const [purchased, paidOnPurchases, paidDirect] = await Promise.all([
      sumBy(this.purchases, 'supplier_id', 'total_amount', ids),
      sumBy(this.purchases, 'supplier_id', 'paid_amount', ids),
      sumBy(this.payments, 'supplier_id', 'amount', ids),
    ]);
    const data = rows.map((s) =>
      Object.assign(
        { ...s },
        balance(
          purchased.get(s.id) ?? 0,
          paidOnPurchases.get(s.id) ?? 0,
          paidDirect.get(s.id) ?? 0,
        ),
      ),
    );
    return adminPage(data, total, page, perPage);
  }

  async findOne(id: number) {
    return orNotFound(await this.suppliers.findOneBy({ id }), 'Supplier');
  }

  /** The supplier with its purchases, payments and running balance. */
  async detail(id: number) {
    const supplier = await this.findOne(id);
    const [purchases, payments] = await Promise.all([
      this.purchases.find({
        where: { supplierId: id },
        order: { purchaseDate: 'DESC', id: 'DESC' },
      }),
      this.payments.find({
        where: { supplierId: id },
        order: { paymentDate: 'DESC', id: 'DESC' },
      }),
    ]);
    const total = (values: string[]) =>
      values.reduce((sum, v) => sum + Number(v), 0);
    return {
      ...supplier,
      ...balance(
        total(purchases.map((p) => p.totalAmount)),
        total(purchases.map((p) => p.paidAmount)),
        total(payments.map((p) => p.amount)),
      ),
      purchaseCount: purchases.length,
      purchases,
      payments,
    };
  }

  private save(dto: SupplierDto, existing?: Supplier) {
    return this.suppliers.save(
      Object.assign(existing ?? this.suppliers.create(), {
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        companyName: dto.companyName ?? null,
        address: dto.address ?? null,
        status: dto.status,
      }),
    );
  }

  create(dto: SupplierDto) {
    return this.save(dto);
  }

  async update(id: number, dto: SupplierDto) {
    return this.save(dto, await this.findOne(id));
  }

  async remove(id: number) {
    const supplier = await this.findOne(id);
    // The FK cascades would silently drop the purchases (and leave their
    // stock behind), so make the admin remove those deliberately first.
    if (await this.purchases.exists({ where: { supplierId: id } })) {
      throw new ConflictException(
        'This supplier has purchases. Delete those purchases first.',
      );
    }
    await this.suppliers.delete(supplier.id);
  }

  async addPayment(id: number, dto: SupplierPaymentDto) {
    const supplier = await this.findOne(id);
    return this.payments.save(
      this.payments.create({
        supplierId: supplier.id,
        amount: fixed(dto.amount),
        paymentDate: dto.paymentDate.slice(0, 10),
        paymentMethod: dto.paymentMethod ?? null,
        note: dto.note ?? null,
      }),
    );
  }

  async removePayment(supplierId: number, paymentId: number) {
    const payment = orNotFound(
      await this.payments.findOneBy({ id: paymentId, supplierId }),
      'Payment',
    );
    await this.payments.delete(payment.id);
  }
}

// -------------------------------------------------------------- investments

@Injectable()
export class InvestmentsAdminService {
  constructor(
    @InjectRepository(Investment)
    private readonly investments: Repository<Investment>,
    @InjectRepository(Purchase)
    private readonly purchases: Repository<Purchase>,
  ) {}

  /** Adds how much of each investment purchases have used and what's left. */
  async withUsage(rows: Investment[]) {
    const used = await sumBy(
      this.purchases,
      'investment_id',
      'total_amount',
      rows.map((r) => r.id),
    );
    return rows.map((r) => {
      const usedAmount = round2(used.get(r.id) ?? 0);
      return {
        ...r,
        usedAmount,
        remainingAmount: round2(Number(r.amount) - usedAmount),
      };
    });
  }

  async findAll(page: number) {
    const perPage = 20;
    const [rows, total] = await this.investments.findAndCount({
      order: { investedDate: 'DESC', id: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    const [investedRow, usedRow] = await Promise.all([
      this.investments
        .createQueryBuilder('i')
        .select('SUM(i.amount)', 'total')
        .getRawOne<{ total: string | null }>(),
      this.purchases
        .createQueryBuilder('p')
        .select('SUM(p.total_amount)', 'total')
        .where('p.investment_id IS NOT NULL')
        .getRawOne<{ total: string | null }>(),
    ]);
    const totalInvested = round2(Number(investedRow?.total ?? 0));
    const totalUsed = round2(Number(usedRow?.total ?? 0));
    return {
      ...adminPage(await this.withUsage(rows), total, page, perPage),
      summary: {
        totalInvested,
        totalUsed,
        totalRemaining: round2(totalInvested - totalUsed),
      },
    };
  }

  async findOne(id: number) {
    return orNotFound(await this.investments.findOneBy({ id }), 'Investment');
  }

  private save(dto: InvestmentDto, existing?: Investment) {
    return this.investments.save(
      Object.assign(existing ?? this.investments.create(), {
        investorName: dto.investorName,
        amount: fixed(dto.amount),
        investedDate: dto.investedDate.slice(0, 10),
        note: dto.note ?? null,
      }),
    );
  }

  create(dto: InvestmentDto) {
    return this.save(dto);
  }

  async update(id: number, dto: InvestmentDto) {
    return this.save(dto, await this.findOne(id));
  }

  async remove(id: number) {
    const investment = await this.findOne(id);
    if (await this.purchases.exists({ where: { investmentId: id } })) {
      throw new ConflictException(
        'This investment is linked to one or more purchases and cannot be deleted.',
      );
    }
    await this.investments.delete(investment.id);
  }
}

// ---------------------------------------------------------------- purchases

@Injectable()
export class PurchasesAdminService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Purchase)
    private readonly purchases: Repository<Purchase>,
    @InjectRepository(Supplier)
    private readonly suppliers: Repository<Supplier>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Investment)
    private readonly investments: Repository<Investment>,
    private readonly investmentsAdmin: InvestmentsAdminService,
  ) {}

  async findAll(page: number) {
    const perPage = 15;
    const [data, total] = await this.purchases.findAndCount({
      relations: { supplier: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return adminPage(data, total, page, perPage);
  }

  async findOne(id: number, manager: EntityManager = this.dataSource.manager) {
    const purchase = orNotFound(
      await manager.findOne(Purchase, {
        where: { id },
        relations: {
          supplier: true,
          investment: true,
          items: { product: true, variant: { color: true, size: true } },
          costs: true,
        },
        order: { items: { id: 'ASC' }, costs: { id: 'ASC' } },
      }),
      'Purchase',
    );
    return {
      ...purchase,
      items: purchase.items.map(({ product, variant, ...item }) => ({
        ...item,
        product: product
          ? { id: product.id, name: product.name, sku: product.sku, stock: product.stock }
          : null,
        variant: variant
          ? {
              id: variant.id,
              label: variantLabel(variant),
              sku: variant.sku,
              stock: variant.stock,
            }
          : null,
      })),
    };
  }

  /** What the purchase form's dropdowns need. */
  async formOptions() {
    const [suppliers, products, investments] = await Promise.all([
      this.suppliers.find({
        where: { status: true },
        order: { name: 'ASC' },
        select: { id: true, name: true, companyName: true },
      }),
      this.products
        .find({
          where: { status: true },
          relations: { variants: { color: true, size: true } },
          order: { name: 'ASC', variants: { id: 'ASC' } },
        })
        .then((rows) =>
          rows.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            stock: p.stock,
            costPrice: p.costPrice,
            variants: p.variants.map((v) => ({
              id: v.id,
              label: variantLabel(v),
              sku: v.sku,
              stock: v.stock,
              status: v.status,
            })),
          })),
        ),
      this.investments
        .find({ order: { investedDate: 'DESC', id: 'DESC' } })
        .then((rows) => this.investmentsAdmin.withUsage(rows)),
    ]);
    return { suppliers, products, investments };
  }

  create(dto: PurchaseDto) {
    return this.dataSource.transaction(async (manager) => {
      await this.assertReferences(manager, dto);
      const subtotal = this.subtotal(dto);
      const purchase = await manager.save(
        manager.create(Purchase, {
          supplierId: dto.supplierId,
          purchaseNumber: await this.nextPurchaseNumber(manager),
          purchaseDate: dto.purchaseDate.slice(0, 10),
          subtotal: fixed(subtotal),
          totalAmount: fixed(subtotal),
          paidAmount: '0.00',
          dueAmount: fixed(subtotal),
          paymentStatus: 'unpaid',
          status: dto.status,
          fundingSource: dto.fundingSource,
          investmentId:
            dto.fundingSource === 'investment' ? (dto.investmentId ?? null) : null,
        }),
      );

      await this.saveItems(manager, purchase, dto);

      const costs = (dto.costs ?? []).filter((c) => c.title && c.amount > 0);
      if (costs.length > 0) {
        await manager.save(
          costs.map((c) =>
            manager.create(PurchaseCost, {
              purchaseId: purchase.id,
              title: c.title,
              amount: fixed(c.amount),
              costDate: purchase.purchaseDate,
            }),
          ),
        );
      }

      await this.recalculate(manager, purchase.id);
      return this.findOne(purchase.id, manager);
    });
  }

  update(id: number, dto: PurchaseDto) {
    return this.dataSource.transaction(async (manager) => {
      const purchase = await this.lockPurchase(manager, id);
      await this.assertReferences(manager, dto);

      // Take back the stock the old items added before replacing them.
      if (purchase.status === 'completed') {
        await this.moveStock(manager, purchase.id, -1);
      }
      await manager.delete(PurchaseItem, { purchaseId: purchase.id });

      Object.assign(purchase, {
        supplierId: dto.supplierId,
        purchaseDate: dto.purchaseDate.slice(0, 10),
        subtotal: fixed(this.subtotal(dto)),
        status: dto.status,
        fundingSource: dto.fundingSource,
        investmentId:
          dto.fundingSource === 'investment' ? (dto.investmentId ?? null) : null,
      });
      await manager.save(purchase);

      await this.saveItems(manager, purchase, dto);
      await this.recalculate(manager, purchase.id);
      return this.findOne(purchase.id, manager);
    });
  }

  /** Receive a pending purchase: its items go into stock. */
  complete(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const purchase = await this.lockPurchase(manager, id);
      if (purchase.status === 'completed') {
        throw new BadRequestException('Purchase already completed.');
      }
      if (purchase.status === 'cancelled') {
        throw new BadRequestException('A cancelled purchase cannot be completed.');
      }
      await this.moveStock(manager, purchase.id, 1);
      purchase.status = 'completed';
      await manager.save(purchase);
      await this.recalculate(manager, purchase.id);
      return this.findOne(purchase.id, manager);
    });
  }

  remove(id: number) {
    return this.dataSource.transaction(async (manager) => {
      const purchase = await this.lockPurchase(manager, id);
      if (purchase.status === 'completed') {
        await this.moveStock(manager, purchase.id, -1);
      }
      await manager.delete(PurchaseItem, { purchaseId: purchase.id });
      await manager.delete(PurchaseCost, { purchaseId: purchase.id });
      await manager.delete(Purchase, purchase.id);
    });
  }

  addPayment(id: number, dto: PurchasePaymentDto) {
    return this.dataSource.transaction(async (manager) => {
      const purchase = await this.lockPurchase(manager, id);
      const paid = Number(purchase.paidAmount) + dto.amount;
      const due = Number(purchase.totalAmount) - paid;
      purchase.paidAmount = fixed(paid);
      purchase.dueAmount = fixed(Math.max(due, 0));
      purchase.paymentStatus = due <= 0 ? 'paid' : 'partial';
      await manager.save(purchase);
      return this.findOne(purchase.id, manager);
    });
  }

  addCost(id: number, dto: PurchaseCostDto) {
    return this.dataSource.transaction(async (manager) => {
      const purchase = await this.lockPurchase(manager, id);
      await manager.save(
        manager.create(PurchaseCost, {
          purchaseId: purchase.id,
          title: dto.title,
          amount: fixed(dto.amount),
          costDate: dto.costDate.slice(0, 10),
        }),
      );
      await this.recalculate(manager, purchase.id);
      return this.findOne(purchase.id, manager);
    });
  }

  removeCost(id: number, costId: number) {
    return this.dataSource.transaction(async (manager) => {
      const purchase = await this.lockPurchase(manager, id);
      const cost = orNotFound(
        await manager.findOneBy(PurchaseCost, { id: costId, purchaseId: purchase.id }),
        'Cost',
      );
      await manager.delete(PurchaseCost, cost.id);
      await this.recalculate(manager, purchase.id);
      return this.findOne(purchase.id, manager);
    });
  }

  // ------------------------------------------------------------- internals

  private subtotal(dto: PurchaseDto) {
    return round2(dto.items.reduce((sum, i) => sum + i.quantity * i.price, 0));
  }

  private async lockPurchase(manager: EntityManager, id: number) {
    return orNotFound(
      await manager.findOne(Purchase, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      }),
      'Purchase',
    );
  }

  private async assertReferences(manager: EntityManager, dto: PurchaseDto) {
    if (!(await manager.exists(Supplier, { where: { id: dto.supplierId } }))) {
      throw new BadRequestException('The selected supplier is invalid.');
    }
    if (
      dto.fundingSource === 'investment' &&
      !(await manager.exists(Investment, { where: { id: dto.investmentId ?? 0 } }))
    ) {
      throw new BadRequestException('The selected investment is invalid.');
    }
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const found = await manager.count(Product, { where: { id: In(productIds) } });
    if (found !== productIds.length) {
      throw new BadRequestException('One or more selected products are invalid.');
    }

    // A product with variants sells from variant stock, so each of its
    // lines must say which variant the stock is for.
    const variants = await manager.find(ProductVariant, {
      where: { productId: In(productIds) },
      select: { id: true, productId: true },
    });
    for (const item of dto.items) {
      const own = variants.filter((v) => v.productId === item.productId);
      if (own.length === 0) {
        item.variantId = null;
      } else if (!item.variantId) {
        throw new BadRequestException('Choose a colour/size variant for every product that has variants.');
      } else if (!own.some((v) => v.id === item.variantId)) {
        throw new BadRequestException('The selected variant does not belong to its product.');
      }
    }
  }

  /** `PUR-<unix seconds>` like the Laravel admin, bumped if that second is taken. */
  private async nextPurchaseNumber(manager: EntityManager) {
    let seconds = Math.floor(Date.now() / 1000);
    while (await manager.exists(Purchase, { where: { purchaseNumber: `PUR-${seconds}` } })) {
      seconds += 1;
    }
    return `PUR-${seconds}`;
  }

  private async saveItems(manager: EntityManager, purchase: Purchase, dto: PurchaseDto) {
    await manager.save(
      dto.items.map((i) =>
        manager.create(PurchaseItem, {
          purchaseId: purchase.id,
          productId: i.productId,
          productVariantId: i.variantId ?? null,
          quantity: i.quantity,
          purchasePrice: fixed(i.price),
          subtotal: fixed(i.quantity * i.price),
        }),
      ),
    );
    if (purchase.status === 'completed') {
      await this.moveStock(manager, purchase.id, 1);
    }
  }

  /** Add (+1) or take back (-1) each item's quantity on its variant's stock, or its product's when it has none. */
  private async moveStock(manager: EntityManager, purchaseId: number, direction: 1 | -1) {
    const items = await manager.find(PurchaseItem, { where: { purchaseId } });
    for (const item of items) {
      if (item.productVariantId) {
        await manager.increment(ProductVariant, { id: item.productVariantId }, 'stock', direction * item.quantity);
      } else {
        await manager.increment(Product, { id: item.productId }, 'stock', direction * item.quantity);
      }
    }
  }

  /**
   * Totals = item subtotal + extra costs, with due/payment status following.
   * Extra costs are then spread over the items by their share of the
   * subtotal to give each a landed unit cost; on a completed purchase that
   * becomes the product's reference cost_price.
   */
  private async recalculate(manager: EntityManager, purchaseId: number) {
    const purchase = await manager.findOneByOrFail(Purchase, { id: purchaseId });
    const costs = await manager.find(PurchaseCost, { where: { purchaseId } });
    const extraCost = costs.reduce((sum, c) => sum + Number(c.amount), 0);

    const subtotal = Number(purchase.subtotal);
    const paid = Number(purchase.paidAmount);
    const totalAmount = subtotal + extraCost;
    const due = Math.max(totalAmount - paid, 0);
    purchase.totalAmount = fixed(totalAmount);
    purchase.dueAmount = fixed(due);
    purchase.paymentStatus = due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    await manager.save(purchase);

    const items = await manager.find(PurchaseItem, { where: { purchaseId } });
    for (const item of items) {
      const share = subtotal > 0 ? Number(item.subtotal) / subtotal : 0;
      const allocated = extraCost * share;
      const landed =
        item.quantity > 0
          ? Number(item.purchasePrice) + allocated / item.quantity
          : Number(item.purchasePrice);
      await manager.update(PurchaseItem, item.id, { landedCost: fixed(landed) });
      if (purchase.status === 'completed') {
        await manager.update(Product, item.productId, { costPrice: fixed(landed) });
      }
    }
  }
}
