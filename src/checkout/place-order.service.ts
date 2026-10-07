import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { AccountService } from '../account/account.service.js';
import {
  cartSubtotal,
  cartUnitPrice,
  cartAvailableStock,
  type CartItem,
} from '../cart/cart-item.entity.js';
import { CartService, type CartOwner } from '../cart/cart.service.js';
import { LaravelValidationException } from '../common/laravel-validation.js';
import { Coupon, couponDiscount } from '../coupons/coupon.entity.js';
import { hashPassword } from '../customer-auth/customer-auth.service.js';
import { passwordErrors } from '../customer-auth/password-rules.js';
import { SanctumTokenService } from '../customer-auth/sanctum-token.service.js';
import { Customer } from '../customers/customer.entity.js';
import { MailService } from '../mail/mail.service.js';
import { OrderItem } from '../orders/order-item.entity.js';
import { Order } from '../orders/order.entity.js';
import { PaymentMethod } from '../payment-methods/payment-method.entity.js';
import { ProductVariant } from '../products/product-variant.entity.js';
import { Product } from '../products/product.entity.js';
import { Setting } from '../settings/setting.entity.js';
import { ShippingZone } from '../shipping-zones/shipping-zone.entity.js';
import { AbandonedCart } from './abandoned-cart.entity.js';
import { CheckoutOtp } from './checkout-otp.entity.js';
import {
  checkoutOtpEmail,
  newOrderAdminEmail,
  orderPlacedEmail,
} from './checkout-emails.js';
import type { PlaceOrderDto } from './dto/checkout.dto.js';

const VERIFY_TOKEN_TTL_SECONDS = 1800;

const unprocessable = (message: string) =>
  new UnprocessableEntityException({ message });

/** Today's date as Y-m-d in UTC (the app timezone). */
const todayUtc = () => new Date().toISOString().slice(0, 10);

/** Mirrors the guest/ordering half of Api\V1\CheckoutController. */
@Injectable()
export class PlaceOrderService {
  private readonly logger = new Logger(PlaceOrderService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(CheckoutOtp)
    private readonly otps: Repository<CheckoutOtp>,
    @InjectRepository(AbandonedCart)
    private readonly abandonedCarts: Repository<AbandonedCart>,
    @InjectRepository(Coupon)
    private readonly coupons: Repository<Coupon>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethods: Repository<PaymentMethod>,
    @InjectRepository(Setting)
    private readonly settings: Repository<Setting>,
    private readonly cart: CartService,
    private readonly tokens: SanctumTokenService,
    private readonly account: AccountService,
    private readonly mail: MailService,
  ) {}

  // -------------------------------------------------------------- verify token

  /** Replaces Laravel's Crypt::encryptString: an HMAC-signed {email, ts}. */
  private signingKey() {
    const secret =
      process.env.CHECKOUT_TOKEN_SECRET || process.env.ADMIN_JWT_SECRET;
    if (!secret)
      throw new Error(
        'CHECKOUT_TOKEN_SECRET (or ADMIN_JWT_SECRET) must be set.',
      );
    return secret;
  }

  private issueVerifyToken(email: string) {
    const payload = Buffer.from(
      JSON.stringify({ email, ts: Math.floor(Date.now() / 1000) }),
    ).toString('base64url');
    const signature = createHmac('sha256', this.signingKey())
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  private verifiedEmailMatches(
    token: string | null | undefined,
    email: string,
  ) {
    const [payload, signature] = (token ?? '').split('.');
    if (!payload || !signature) return false;

    const expected = createHmac('sha256', this.signingKey())
      .update(payload)
      .digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return false;

    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
        email?: string;
        ts?: number;
      };
      return (
        data.email === email &&
        Math.floor(Date.now() / 1000) - Number(data.ts ?? 0) <=
          VERIFY_TOKEN_TTL_SECONDS
      );
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------------------- OTP

  private async siteName() {
    const setting = await this.settings.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    return setting?.siteName || 'Barakahly';
  }

  async sendOtp(email: string) {
    const code = String(randomInt(100000, 1000000));
    await this.otps.save(
      this.otps.create({
        email,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }),
    );

    try {
      await this.mail.send({
        to: email,
        subject: 'Your verification code',
        html: checkoutOtpEmail(await this.siteName(), code),
        required: true,
      });
    } catch (error) {
      this.logger.warn(
        `Checkout code email failed: ${(error as Error).message}`,
      );
      throw unprocessable(
        'Could not send the verification email. Please check the address and try again.',
      );
    }

    return { message: 'Verification code sent.' };
  }

  async verifyOtp(owner: CartOwner, email: string, code: string) {
    const otp = await this.otps.findOne({
      where: { email, code, expiresAt: MoreThanOrEqual(new Date()) },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    if (!otp) throw unprocessable('Invalid or expired code.');

    await this.otps.update(otp.id, {
      verifiedAt: new Date(),
      updatedAt: new Date(),
    });

    const lines = await this.cart.lines(owner);
    if (lines.length) {
      const snapshot = lines.map((line) => ({
        id: line.productId,
        name: line.product.name,
        variant_id: line.productVariantId,
        quantity: line.quantity,
        subtotal: cartSubtotal(line),
      }));
      const total = snapshot.reduce((sum, line) => sum + line.subtotal, 0);
      const existing = await this.abandonedCarts.findOneBy({
        email,
        recoveredAt: IsNull(),
      });
      await this.abandonedCarts.save(
        existing
          ? Object.assign(existing, {
              cartSnapshot: snapshot,
              cartTotal: total.toFixed(2),
            })
          : this.abandonedCarts.create({
              email,
              cartSnapshot: snapshot,
              cartTotal: total.toFixed(2),
            }),
      );
    }

    return {
      message: 'Email verified.',
      verify_token: this.issueVerifyToken(email),
    };
  }

  // -------------------------------------------------------------------- coupon

  /** An active coupon whose date window includes today (UTC). */
  private async validCoupon(code: string) {
    const today = todayUtc();
    return this.coupons
      .createQueryBuilder('coupon')
      .where('coupon.code = :code', { code: code.toUpperCase() })
      .andWhere('coupon.status = 1')
      .andWhere('(coupon.startDate IS NULL OR coupon.startDate <= :today)', {
        today,
      })
      .andWhere('(coupon.endDate IS NULL OR coupon.endDate >= :today)', {
        today,
      })
      .getOne();
  }

  async applyCoupon(owner: CartOwner, code: string) {
    const coupon = await this.validCoupon(code);
    if (!coupon) throw unprocessable('Invalid coupon code.');

    const subtotal = (await this.cart.lines(owner)).reduce(
      (sum, line) => sum + cartSubtotal(line),
      0,
    );
    if (Number(coupon.minOrderAmount) > subtotal)
      throw unprocessable('Minimum order amount not reached.');

    return { code: coupon.code, discount: couponDiscount(coupon, subtotal) };
  }

  // --------------------------------------------------------------------- order

  async placeOrder(
    owner: CartOwner,
    authCustomer: Customer | undefined,
    dto: PlaceOrderDto,
  ) {
    if (!authCustomer) {
      const errors: Record<string, string[]> = {};
      if (!dto.verify_token)
        errors.verify_token = ['The verify token field is required.'];
      const problems = passwordErrors(dto.password, dto.password_confirmation);
      if (problems.length) errors.password = problems.slice(0, 1);
      if (Object.keys(errors).length)
        throw new LaravelValidationException(errors);

      if (!this.verifiedEmailMatches(dto.verify_token, dto.email)) {
        throw unprocessable(
          'Please verify your email address before placing the order.',
        );
      }
    }

    const paymentMethod = await this.paymentMethods.findOneBy({
      id: dto.payment_method_id,
    });
    if (!paymentMethod) {
      throw LaravelValidationException.field(
        'payment_method_id',
        'The selected payment method id is invalid.',
      );
    }
    if (paymentMethod.requiresTransactionId) {
      const errors: Record<string, string[]> = {};
      if (!dto.transaction_id || typeof dto.transaction_id !== 'string') {
        errors.transaction_id = ['The transaction id field is required.'];
      } else if (dto.transaction_id.length > 100) {
        errors.transaction_id = [
          'The transaction id field must not be greater than 100 characters.',
        ];
      }
      if (!dto.payment_date) {
        errors.payment_date = ['The payment date field is required.'];
      } else if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dto.payment_date) ||
        Number.isNaN(Date.parse(dto.payment_date))
      ) {
        errors.payment_date = ['The payment date field must be a valid date.'];
      } else if (dto.payment_date > todayUtc()) {
        errors.payment_date = [
          'The payment date field must be a date before or equal to today.',
        ];
      }
      if (Object.keys(errors).length)
        throw new LaravelValidationException(errors);
    }

    const coupon = dto.coupon_code
      ? await this.validCoupon(dto.coupon_code)
      : null;

    let newToken: string | null = null;
    let orderId: number;
    try {
      orderId = await this.dataSource.transaction(async (manager) => {
        const zone = await manager.findOneBy(ShippingZone, {
          id: dto.shipping_zone_id,
          status: true,
        });
        if (!zone)
          throw new Error(
            'No query results for model [App\\Models\\ShippingZone].',
          );

        const lines: CartItem[] = await this.cart.lines(owner, manager);
        if (!lines.length) throw new Error('Your cart is empty.');

        // Customer: the signed-in one, or find-or-create by phone for guests.
        let customer: Customer;
        if (authCustomer) {
          await manager.update(Customer, authCustomer.id, {
            updatedAt: new Date(),
            name: dto.name,
            address: dto.address,
            email: dto.email || authCustomer.email,
          });
          customer = authCustomer;
        } else {
          const existing = await manager
            .createQueryBuilder(Customer, 'customer')
            .addSelect('customer.password')
            .where('customer.phone = :phone', { phone: dto.phone })
            .getOne();

          if (existing?.password) {
            // The phone already belongs to an account with a password. The
            // order is still recorded against it, but the guest is neither
            // signed into that account nor allowed to change its details -
            // knowing a phone number must not grant access to someone's account.
            customer = existing;
          } else {
            const password = await hashPassword(dto.password as string);
            if (existing) {
              await manager.update(Customer, existing.id, {
                updatedAt: new Date(),
                name: dto.name,
                address: dto.address,
                email: dto.email,
                status: true,
                password,
              });
              customer = existing;
            } else {
              customer = await manager.save(
                manager.create(Customer, {
                  name: dto.name,
                  phone: dto.phone,
                  address: dto.address,
                  email: dto.email,
                  status: true,
                  password,
                }),
              );
            }
            newToken = await this.tokens.issue(customer.id);
          }
        }

        for (const line of lines) {
          if (cartAvailableStock(line) < line.quantity)
            throw new Error(`${line.product.name} stock not available`);
        }

        const subtotal = lines.reduce(
          (sum, line) => sum + cartSubtotal(line),
          0,
        );
        const discount =
          coupon && Number(coupon.minOrderAmount) <= subtotal
            ? Math.min(couponDiscount(coupon, subtotal), subtotal)
            : 0;
        const appliedCoupon = discount > 0 ? coupon : null;
        const shipping = Number(zone.charge);

        // ORD-{unix seconds}, as before; order_number is unique, so a second
        // order in the same second gets a -2, -3... suffix instead of failing.
        const base = `ORD-${Math.floor(Date.now() / 1000)}`;
        let orderNumber = base;
        for (let n = 2; await manager.existsBy(Order, { orderNumber }); n++)
          orderNumber = `${base}-${n}`;

        const order = await manager.save(
          manager.create(Order, {
            customerId: customer.id,
            orderNumber,
            couponId: appliedCoupon?.id ?? null,
            couponCode: appliedCoupon?.code ?? null,
            subtotal: subtotal.toFixed(2),
            shippingZoneId: zone.id,
            shippingCharge: shipping.toFixed(2),
            discountAmount: discount.toFixed(2),
            totalAmount: (subtotal + shipping - discount).toFixed(2),
            paymentMethodId: paymentMethod.id,
            paymentMethod: paymentMethod.name,
            paymentGateway: paymentMethod.code,
            transactionId: paymentMethod.requiresTransactionId
              ? (dto.transaction_id ?? null)
              : null,
            paymentDate: paymentMethod.requiresTransactionId
              ? (dto.payment_date ?? null)
              : null,
            paymentStatus: 'pending',
            orderStatus: 'pending',
            shippingAddress: dto.address,
          }),
        );

        for (const line of lines) {
          await manager.save(
            manager.create(OrderItem, {
              orderId: order.id,
              productId: line.productId,
              productVariantId: line.productVariantId,
              productName: line.product.name,
              variantColor: line.variant?.color?.name ?? null,
              variantSize: line.variant?.size?.name ?? null,
              price: cartUnitPrice(line).toFixed(2),
              quantity: line.quantity,
              subtotal: cartSubtotal(line).toFixed(2),
            }),
          );

          // Decrement only while enough stock remains, so two orders racing
          // for the last units can't drive stock negative.
          const target = line.productVariantId ? ProductVariant : Product;
          const result = await manager
            .createQueryBuilder()
            .update(target)
            .set({ stock: () => `stock - ${Number(line.quantity)}` })
            .where('id = :id', { id: line.productVariantId ?? line.productId })
            .andWhere('stock >= :quantity', { quantity: line.quantity })
            .execute();
          if (!result.affected)
            throw new Error(`${line.product.name} stock not available`);
        }

        await this.cart.clear(owner, manager);
        return order.id;
      });
    } catch (error) {
      throw unprocessable((error as Error).message);
    }

    await this.abandonedCarts.update(
      { email: dto.email, recoveredAt: IsNull() },
      { recoveredAt: new Date(), updatedAt: new Date() },
    );

    const order = await this.dataSource.getRepository(Order).findOneOrFail({
      where: { id: orderId },
      relations: { customer: true },
    });
    if (paymentMethod.code !== 'sslcommerz') {
      // Fire-and-forget, like Laravel's queued mailables.
      void this.sendOrderPlacedNotifications(order);
    }

    return { order: await this.account.orderWithItems(order), token: newToken };
  }

  /** OrderNotificationService::sendOrderPlacedNotifications (email part). */
  private async sendOrderPlacedNotifications(order: Order) {
    try {
      const items = await this.dataSource.getRepository(OrderItem).find({
        where: { orderId: order.id },
        order: { id: 'ASC' },
      });
      const setting = await this.settings.findOne({
        where: {},
        order: { id: 'ASC' },
      });
      const siteName = setting?.siteName || 'Barakahly';
      const storefront = (
        process.env.STOREFRONT_URL ??
        process.env.APP_URL ??
        ''
      ).replace(/\/+$/, '');
      const admin = (process.env.ADMIN_URL ?? '').replace(/\/+$/, '');

      if (order.customer?.email) {
        await this.mail
          .send({
            to: order.customer.email,
            subject: `Order Confirmation - ${order.orderNumber}`,
            html: orderPlacedEmail(
              siteName,
              order,
              items,
              order.customer,
              `${storefront}/order-success/${order.id}`,
            ),
          })
          .catch((error: Error) =>
            this.logger.warn(
              `Failed to send order confirmation email: ${error.message}`,
            ),
          );
      }

      if (setting?.contactEmail) {
        await this.mail
          .send({
            to: setting.contactEmail,
            subject: `New Order Received - ${order.orderNumber}`,
            html: newOrderAdminEmail(
              siteName,
              order,
              items,
              order.customer,
              `${admin}/orders/${order.id}`,
            ),
          })
          .catch((error: Error) =>
            this.logger.warn(
              `Failed to send new order admin notification: ${error.message}`,
            ),
          );
      }
    } catch (error) {
      this.logger.warn(
        `Order notifications failed: ${(error as Error).message}`,
      );
    }
  }
}
