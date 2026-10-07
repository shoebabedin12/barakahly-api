import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, IsNull, Repository } from 'typeorm';
import { assetUrl } from '../common/asset-url.js';
import type { CustomerRequest } from '../customer-auth/customer-auth.guard.js';
import { ProductImage } from '../products/product-image.entity.js';
import { ProductVariant } from '../products/product-variant.entity.js';
import { Product } from '../products/product.entity.js';
import {
  CartItem,
  cartAvailableStock,
  cartSubtotal,
  cartUnitPrice,
} from './cart-item.entity.js';

/** ResolveCartOwner middleware: the signed-in customer, else the guest token (new if absent). */
export interface CartOwner {
  customerId: number | null;
  guestToken: string | null;
}

export function resolveCartOwner(request: CustomerRequest): CartOwner {
  if (request.customer)
    return { customerId: request.customer.id, guestToken: null };
  const header = request.headers['x-guest-token'];
  const token = (Array.isArray(header) ? header[0] : header) || randomUUID();
  return { customerId: null, guestToken: token };
}

export function ownerWhere(owner: CartOwner) {
  return owner.customerId
    ? { customerId: owner.customerId }
    : { customerId: IsNull(), guestToken: owner.guestToken ?? '' };
}

const unprocessable = (message: string) =>
  new UnprocessableEntityException({ message });

/** Mirrors Api\V1\CartController and CartMergeService. */
@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly items: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    @InjectRepository(ProductImage)
    private readonly images: Repository<ProductImage>,
  ) {}

  /** The owner's lines with product, variant (+ color/size) loaded, newest first. */
  async lines(owner: CartOwner, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(CartItem) : this.items;
    return repo.find({
      where: ownerWhere(owner),
      relations: { product: true, variant: { color: true, size: true } },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  async cartResponse(owner: CartOwner) {
    const lines = await this.lines(owner);
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const images = productIds.length
      ? await this.images.find({
          where: productIds.map((productId) => ({ productId })),
          order: { sortOrder: 'ASC', id: 'ASC' },
        })
      : [];

    const items = lines.map((line) => {
      const image =
        line.variant?.image ??
        images.find((img) => img.productId === line.productId)?.image ??
        null;
      const hasDiscount =
        !line.variant &&
        line.product.discountPrice !== null &&
        Number(line.product.discountPrice) < Number(line.product.price);

      return {
        id: line.id,
        product_id: line.productId,
        product_variant_id: line.productVariantId,
        name: line.product.name,
        slug: line.product.slug,
        sku: line.product.sku,
        variant_color: line.variant?.color?.name ?? null,
        variant_size: line.variant?.size?.name ?? null,
        image: image ? assetUrl(image) : null,
        unit_price: cartUnitPrice(line),
        original_price: hasDiscount ? Number(line.product.price) : null,
        quantity: line.quantity,
        max_stock: cartAvailableStock(line),
        subtotal: cartSubtotal(line),
      };
    });

    return {
      items,
      subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      guest_token: owner.guestToken,
    };
  }

  async add(
    owner: CartOwner,
    productId: number,
    variantId: number | null,
    quantity: number,
  ) {
    const product = await this.products.findOneBy({ id: productId });
    if (!product) {
      throw new UnprocessableEntityException({
        message: 'The selected product id is invalid.',
        errors: { product_id: ['The selected product id is invalid.'] },
      });
    }

    let variant: ProductVariant | null = null;
    if (variantId) {
      variant = await this.variants.findOneBy({
        id: variantId,
        productId: product.id,
        status: true,
      });
      if (!variant) throw unprocessable('Selected variant is not available.');
    } else if (
      await this.variants.existsBy({ productId: product.id, status: true })
    ) {
      throw unprocessable('Please select the available options.');
    }

    const available = variant ? variant.stock : product.stock;
    if (available < 1)
      throw unprocessable('This product is currently out of stock.');

    const key = {
      ...ownerWhere(owner),
      productId: product.id,
      productVariantId: variant ? variant.id : IsNull(),
    };
    const existing = await this.items.findOneBy(key);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, available);
      await this.items.save(existing);
    } else {
      await this.items.save(
        this.items.create({
          customerId: owner.customerId,
          guestToken: owner.guestToken,
          productId: product.id,
          productVariantId: variant?.id ?? null,
          quantity: Math.min(quantity, available),
        }),
      );
    }
  }

  private async ownedLine(owner: CartOwner, id: number) {
    const line = await this.items.findOne({
      where: { id },
      relations: { product: true, variant: true },
    });
    if (!line)
      throw new NotFoundException({
        message: 'No query results for model [App\\Models\\CartItem].',
      });

    const matches = owner.customerId
      ? line.customerId === owner.customerId
      : line.customerId === null && line.guestToken === owner.guestToken;
    if (!matches)
      throw new ForbiddenException({ message: 'This action is unauthorized.' });
    return line;
  }

  async update(owner: CartOwner, id: number, quantity: number) {
    const line = await this.ownedLine(owner, id);
    line.quantity = Math.min(quantity, Math.max(1, cartAvailableStock(line)));
    await this.items.save(line);
  }

  async remove(owner: CartOwner, id: number) {
    const line = await this.ownedLine(owner, id);
    await this.items.delete(line.id);
  }

  async clear(owner: CartOwner, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(CartItem) : this.items;
    await repo.delete(ownerWhere(owner));
  }

  /** CartMergeService::merge - fold a guest cart into the customer's after sign-in. */
  async mergeGuestCart(
    customerId: number,
    guestToken: string | null | undefined,
  ) {
    if (!guestToken) return;
    const guestLines = await this.lines({ customerId: null, guestToken });

    for (const guest of guestLines) {
      const available = cartAvailableStock(guest);
      const key = {
        customerId,
        productId: guest.productId,
        productVariantId: guest.productVariantId ?? IsNull(),
      };
      const existing = await this.items.findOneBy(key);
      const quantity = Math.min(
        (existing?.quantity ?? 0) + guest.quantity,
        Math.max(1, available),
      );

      if (existing) {
        existing.quantity = quantity;
        await this.items.save(existing);
      } else {
        await this.items.save(
          this.items.create({
            customerId,
            guestToken: null,
            productId: guest.productId,
            productVariantId: guest.productVariantId,
            quantity,
          }),
        );
      }
      await this.items.delete(guest.id);
    }
  }
}
