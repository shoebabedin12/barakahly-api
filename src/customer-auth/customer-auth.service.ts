import {
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Not, Repository } from 'typeorm';
import { CartService } from '../cart/cart.service.js';
import { assetUrl } from '../common/asset-url.js';
import { LaravelValidationException } from '../common/laravel-validation.js';
import { deletePublicFile, storedPath } from '../common/public-storage.js';
import { Customer } from '../customers/customer.entity.js';
import { Order } from '../orders/order.entity.js';
import { Wishlist } from '../wishlist/wishlist.entity.js';
import type {
  LoginDto,
  RegisterDto,
  UpdatePasswordDto,
  UpdateProfileDto,
} from './dto/customer-auth.dto.js';
import { passwordErrors } from './password-rules.js';
import { SanctumTokenService } from './sanctum-token.service.js';

const BCRYPT_ROUNDS = 12;

/**
 * Bcrypt hash in PHP's `$2y$` flavour. bcryptjs writes `$2b$`, the same
 * algorithm, but Laravel's hasher only accepts `$2y$`, so stored hashes stay
 * readable by both.
 */
export async function hashPassword(password: string) {
  return (await bcrypt.hash(password, BCRYPT_ROUNDS)).replace(
    /^\$2b\$/,
    '$2y$',
  );
}

const blankToNull = (value: string | null | undefined) =>
  value === '' || value === undefined ? null : value;

/** Mirrors the password/profile half of Api\V1\AuthController. */
@Injectable()
export class CustomerAuthService {
  constructor(
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(Wishlist)
    private readonly wishlists: Repository<Wishlist>,
    private readonly tokens: SanctumTokenService,
    private readonly cart: CartService,
  ) {}

  /** AuthController::formatCustomer. */
  async present(customer: Customer) {
    const [spent, ordersCount, wishlistCount] = await Promise.all([
      this.orders
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.totalAmount), 0)', 'total')
        .where('o.customerId = :id', { id: customer.id })
        .andWhere("o.orderStatus = 'delivered'")
        .getRawOne<{ total: string }>(),
      this.orders.countBy({ customerId: customer.id }),
      this.wishlists.countBy({ customerId: customer.id }),
    ]);

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      avatar: assetUrl(customer.avatar),
      address: customer.address,
      city: customer.city,
      total_spent: Number(spent?.total ?? 0),
      orders_count: ordersCount,
      wishlist_count: wishlistCount,
    };
  }

  /** Signs the customer in: merge the guest cart, issue a token. */
  async signIn(customer: Customer, guestToken?: string | null) {
    await this.cart.mergeGuestCart(customer.id, guestToken);
    return {
      token: await this.tokens.issue(customer.id),
      customer: await this.present(customer),
    };
  }

  private async uniqueErrors(
    phone: string,
    email: string | null,
    ignoreId?: number,
  ) {
    const errors: Record<string, string[]> = {};
    const notMe = ignoreId ? { id: Not(ignoreId) } : {};
    if (await this.customers.existsBy({ phone, ...notMe })) {
      errors.phone = ['The phone has already been taken.'];
    }
    if (email && (await this.customers.existsBy({ email, ...notMe }))) {
      errors.email = ['The email has already been taken.'];
    }
    return errors;
  }

  async register(dto: RegisterDto) {
    const email = blankToNull(dto.email);
    const errors = await this.uniqueErrors(dto.phone, email);
    const passwordProblems = passwordErrors(
      dto.password,
      dto.password_confirmation,
    );
    if (passwordProblems.length) errors.password = passwordProblems.slice(0, 1);
    if (Object.keys(errors).length)
      throw new LaravelValidationException(errors);

    const customer = await this.customers.save(
      this.customers.create({
        name: dto.name,
        phone: dto.phone,
        email,
        address: blankToNull(dto.address),
        password: await hashPassword(dto.password as string),
        status: true,
      }),
    );

    return this.signIn(customer, dto.guest_token);
  }

  async login(dto: LoginDto) {
    const field = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.login)
      ? 'email'
      : 'phone';
    const customer = await this.customers
      .createQueryBuilder('customer')
      .addSelect('customer.password')
      .where(`customer.${field} = :login`, { login: dto.login })
      .getOne();

    const valid = customer?.password
      ? await bcrypt.compare(dto.password, customer.password)
      : false;
    if (!customer || !valid) {
      throw new UnprocessableEntityException({
        message: 'The provided credentials do not match our records.',
      });
    }

    return this.signIn(customer, dto.guest_token);
  }

  async logout(tokenId: number) {
    await this.tokens.revoke(tokenId);
    return { message: 'Logged out successfully.' };
  }

  async updateProfile(customer: Customer, dto: UpdateProfileDto) {
    const email = blankToNull(dto.email);
    const errors = await this.uniqueErrors(dto.phone, email, customer.id);
    if (Object.keys(errors).length)
      throw new LaravelValidationException(errors);

    // Like $customer->update($validated): only the fields that were sent.
    await this.customers.update(customer.id, {
      updatedAt: new Date(),
      name: dto.name,
      phone: dto.phone,
      ...(dto.email !== undefined ? { email } : {}),
      ...(dto.address !== undefined
        ? { address: blankToNull(dto.address) }
        : {}),
      ...(dto.city !== undefined ? { city: blankToNull(dto.city) } : {}),
    });

    const updated = await this.customers.findOneByOrFail({ id: customer.id });
    return { customer: await this.present(updated) };
  }

  async updatePassword(customer: Customer, dto: UpdatePasswordDto) {
    const problems = passwordErrors(dto.password, dto.password_confirmation);
    if (problems.length)
      throw LaravelValidationException.field('password', problems[0]);

    const row = await this.customers
      .createQueryBuilder('customer')
      .addSelect('customer.password')
      .where('customer.id = :id', { id: customer.id })
      .getOne();
    const valid = row?.password
      ? await bcrypt.compare(dto.current_password, row.password)
      : false;
    if (!valid) {
      throw LaravelValidationException.field(
        'current_password',
        'The current password is incorrect.',
      );
    }

    await this.customers.update(customer.id, {
      updatedAt: new Date(),
      password: await hashPassword(dto.password as string),
    });
    return { message: 'Password updated successfully.' };
  }

  /** Replaces the profile photo with a just-uploaded file, removing the old one. */
  async setAvatar(customer: Customer, file: Express.Multer.File | undefined) {
    if (!file)
      throw LaravelValidationException.field(
        'avatar',
        'Please choose a JPG, PNG or WEBP image.',
      );
    const old = customer.avatar;
    await this.customers.update(customer.id, {
      avatar: storedPath('avatars', file),
      updatedAt: new Date(),
    });
    if (old) await deletePublicFile(old);
    return {
      customer: await this.present(
        await this.customers.findOneByOrFail({ id: customer.id }),
      ),
    };
  }

  async removeAvatar(customer: Customer) {
    if (customer.avatar) {
      await this.customers.update(customer.id, {
        avatar: null,
        updatedAt: new Date(),
      });
      await deletePublicFile(customer.avatar);
    }
    return {
      customer: await this.present(
        await this.customers.findOneByOrFail({ id: customer.id }),
      ),
    };
  }

  assertActive(customer: Customer) {
    if (!customer.status)
      throw new ForbiddenException({
        message: 'This account has been disabled.',
      });
  }
}
