import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { ProductVariant } from '../products/product-variant.entity.js';
import { Product } from '../products/product.entity.js';

/** A cart line, owned by either a signed-in customer or an anonymous guest token. */
@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId: number | null;

  @Column({ name: 'guest_token', type: 'varchar', nullable: true })
  guestToken: string | null;

  @Column({ name: 'product_id', type: 'int' })
  productId: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product>;

  @Column({ name: 'product_variant_id', type: 'int', nullable: true })
  productVariantId: number | null;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_variant_id' })
  variant: Relation<ProductVariant> | null;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

/** CartItem::getUnitPriceAttribute - the variant's own price, else the product's sale price. */
export function cartUnitPrice(item: CartItem): number {
  const price =
    item.variant?.price ?? item.product.discountPrice ?? item.product.price;
  return Number(price);
}

export function cartSubtotal(item: CartItem): number {
  return cartUnitPrice(item) * item.quantity;
}

/** Stock available for this line: the variant's when it has one, otherwise the product's. */
export function cartAvailableStock(item: CartItem): number {
  return item.variant ? item.variant.stock : item.product.stock;
}
