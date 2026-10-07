import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductPresenterService } from '../catalog/product-presenter.service.js';
import { laravelPaginated, positiveInt } from '../common/laravel-pagination.js';
import type { Customer } from '../customers/customer.entity.js';
import { OrderItem } from '../orders/order-item.entity.js';
import { Order } from '../orders/order.entity.js';
import { Product } from '../products/product.entity.js';
import { Review } from '../reviews/review.entity.js';
import { Wishlist } from '../wishlist/wishlist.entity.js';
import { presentOrder } from './order-presenter.js';

/** Mirrors Api\V1\OrderController, WishlistController and ReviewController. */
@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Wishlist)
    private readonly wishlists: Repository<Wishlist>,
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    private readonly presenter: ProductPresenterService,
  ) {}

  // -------------------------------------------------------------------- orders

  async ordersIndex(customer: Customer, pageParam: unknown) {
    const perPage = 10;
    const page = positiveInt(pageParam, 1);
    const [orders, total] = await this.orders.findAndCount({
      where: { customerId: customer.id },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return laravelPaginated(
      orders.map((order) => presentOrder(order)),
      { page, perPage, total, path: '/api/v1/orders' },
    );
  }

  /** Order with its items, for the customer who placed it (403 otherwise). */
  async orderShow(customer: Customer, id: number) {
    const order = await this.orders.findOneBy({ id });
    if (!order)
      throw new NotFoundException({
        message: 'No query results for model [App\\Models\\Order].',
      });
    if (order.customerId !== customer.id)
      throw new ForbiddenException({ message: 'This action is unauthorized.' });
    return { data: await this.orderWithItems(order) };
  }

  async orderWithItems(order: Order) {
    const items = await this.orderItems.find({
      where: { orderId: order.id },
      order: { id: 'ASC' },
    });
    const productIds = items
      .map((item) => item.productId)
      .filter((id): id is number => id !== null);
    const images = await this.presenter.imagesFor([...new Set(productIds)]);
    return presentOrder(order, items, images);
  }

  // ------------------------------------------------------------------ wishlist

  async wishlistIndex(customer: Customer) {
    const rows = await this.wishlists.find({
      where: { customerId: customer.id },
      select: { productId: true },
    });
    const products = rows.length
      ? await this.products.find({
          where: { id: In(rows.map((row) => row.productId)) },
          relations: { category: true },
          order: { id: 'ASC' },
        })
      : [];
    return {
      data: await this.presenter.listItems(products, { withCategory: true }),
    };
  }

  private async findProduct(id: number) {
    const product = await this.products.findOneBy({ id });
    if (!product)
      throw new NotFoundException({
        message: 'No query results for model [App\\Models\\Product].',
      });
    return product;
  }

  async wishlistToggle(customer: Customer, productId: number) {
    const product = await this.findProduct(productId);
    const existing = await this.wishlists.findOneBy({
      customerId: customer.id,
      productId: product.id,
    });
    if (existing) {
      await this.wishlists.delete(existing.id);
      return { wishlisted: false };
    }
    await this.wishlists.save(
      this.wishlists.create({ customerId: customer.id, productId: product.id }),
    );
    return { wishlisted: true };
  }

  // ------------------------------------------------------------------- reviews

  async reviewStore(
    customer: Customer,
    productId: number,
    rating: number,
    comment: string | null,
  ) {
    const product = await this.findProduct(productId);

    if (
      await this.reviews.existsBy({
        productId: product.id,
        customerId: customer.id,
      })
    ) {
      throw new UnprocessableEntityException({
        message: 'You have already reviewed this product.',
      });
    }

    // Link the review to a delivered order containing the product, if any.
    const delivered = await this.orders
      .createQueryBuilder('o')
      .select('o.id', 'id')
      .where('o.customerId = :customerId', { customerId: customer.id })
      .andWhere("o.orderStatus = 'delivered'")
      .andWhere(
        'EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_id = :productId)',
        {
          productId: product.id,
        },
      )
      .limit(1)
      .getRawOne<{ id: number }>();

    const review = await this.reviews.save(
      this.reviews.create({
        productId: product.id,
        customerId: customer.id,
        orderId: delivered ? Number(delivered.id) : null,
        rating,
        comment,
        status: true,
      }),
    );

    return { id: review.id, message: 'Thank you for your review!' };
  }

  async reviewDestroy(customer: Customer, id: number) {
    const review = await this.reviews.findOneBy({ id });
    if (!review)
      throw new NotFoundException({
        message: 'No query results for model [App\\Models\\Review].',
      });
    if (review.customerId !== customer.id)
      throw new ForbiddenException({ message: 'This action is unauthorized.' });
    await this.reviews.delete(review.id);
    return { message: 'Review deleted.' };
  }
}
