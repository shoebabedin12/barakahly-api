import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Not, Repository } from 'typeorm';
import { LaravelValidationException } from '../common/laravel-validation.js';
import { hashPassword } from '../customer-auth/customer-auth.service.js';
import { passwordErrors } from '../customer-auth/password-rules.js';
import { Customer } from '../customers/customer.entity.js';
import { Order } from '../orders/order.entity.js';
import type { CustomerAdminDto } from './dto/store-admin.dto.js';
import { adminPage, orNotFound } from './admin-page.js';

const PER_PAGE = 20;

/** Admin\CustomerController. */
@Injectable()
export class CustomersAdminService {
  constructor(
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
  ) {}

  private async stats(ids: number[]) {
    const map = new Map<number, { ordersCount: number; totalSpent: number }>();
    if (!ids.length) return map;
    const rows = await this.orders
      .createQueryBuilder('o')
      .select('o.customerId', 'customerId')
      .addSelect('COUNT(*)', 'ordersCount')
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.orderStatus = 'delivered' THEN o.totalAmount ELSE 0 END), 0)",
        'totalSpent',
      )
      .where('o.customerId IN (:...ids)', { ids })
      .groupBy('o.customerId')
      .getRawMany<{
        customerId: number;
        ordersCount: string;
        totalSpent: string;
      }>();
    for (const row of rows) {
      map.set(Number(row.customerId), {
        ordersCount: Number(row.ordersCount),
        totalSpent: Number(row.totalSpent),
      });
    }
    return map;
  }

  async findAll(page: number, search?: string) {
    const qb = this.customers
      .createQueryBuilder('c')
      .orderBy('c.createdAt', 'DESC')
      .addOrderBy('c.id', 'DESC');
    if (search?.trim()) {
      const like = `%${search.trim()}%`;
      qb.where(
        new Brackets((w) =>
          w
            .where('c.name LIKE :like', { like })
            .orWhere('c.phone LIKE :like')
            .orWhere('c.email LIKE :like'),
        ),
      );
    }
    const [rows, total] = await qb
      .skip((page - 1) * PER_PAGE)
      .take(PER_PAGE)
      .getManyAndCount();
    const stats = await this.stats(rows.map((c) => c.id));
    return adminPage(
      rows.map((c) => ({
        ...c,
        ...(stats.get(c.id) ?? { ordersCount: 0, totalSpent: 0 }),
      })),
      total,
      page,
      PER_PAGE,
    );
  }

  async findOne(id: number) {
    const customer = orNotFound(
      await this.customers
        .createQueryBuilder('c')
        .addSelect('c.password')
        .where('c.id = :id', { id })
        .getOne(),
      'Customer',
    );
    const { password, ...rest } = customer;
    const [orders, stats] = await Promise.all([
      this.orders.find({
        where: { customerId: id },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
      this.stats([id]),
    ]);
    return {
      ...rest,
      hasPassword: Boolean(password),
      ...(stats.get(id) ?? { ordersCount: 0, totalSpent: 0 }),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalAmount: o.totalAmount,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
      })),
    };
  }

  private async validate(dto: CustomerAdminDto, id?: number) {
    const errors: Record<string, string[]> = {};
    const notMe = id ? { id: Not(id) } : {};
    if (await this.customers.existsBy({ phone: dto.phone, ...notMe }))
      errors.phone = ['The phone has already been taken.'];
    if (
      dto.email &&
      (await this.customers.existsBy({ email: dto.email, ...notMe }))
    ) {
      errors.email = ['The email has already been taken.'];
    }
    if (dto.password) {
      const problems = passwordErrors(dto.password, dto.passwordConfirmation);
      if (problems.length) errors.password = problems.slice(0, 1);
    }
    if (Object.keys(errors).length)
      throw new LaravelValidationException(errors);
  }

  private async fields(dto: CustomerAdminDto) {
    return {
      name: dto.name,
      phone: dto.phone,
      email: dto.email ?? null,
      address: dto.address ?? null,
      city: dto.city ?? null,
      status: dto.status,
      ...(dto.password ? { password: await hashPassword(dto.password) } : {}),
    };
  }

  async create(dto: CustomerAdminDto) {
    await this.validate(dto);
    const saved = await this.customers.save(
      this.customers.create(await this.fields(dto)),
    );
    return this.findOne(saved.id);
  }

  async update(id: number, dto: CustomerAdminDto) {
    orNotFound(await this.customers.findOneBy({ id }), 'Customer');
    await this.validate(dto, id);
    await this.customers.update(id, {
      ...(await this.fields(dto)),
      updatedAt: new Date(),
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    const customer = orNotFound(
      await this.customers.findOneBy({ id }),
      'Customer',
    );
    // Orders keep their history (customer_id is set to NULL by the foreign key).
    await this.customers.delete(customer.id);
  }
}
