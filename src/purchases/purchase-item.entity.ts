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
import type { Purchase } from './purchase.entity.js';

@Entity('purchase_items')
export class PurchaseItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'purchase_id', type: 'int' })
  purchaseId: number;

  @ManyToOne('Purchase', (purchase: Purchase) => purchase.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase: Relation<Purchase>;

  @Column({ name: 'product_id', type: 'int' })
  productId: number;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  /** Set when the line received stock for one colour/size variant. */
  @Column({ name: 'product_variant_id', type: 'int', nullable: true })
  productVariantId: number | null;

  @ManyToOne(() => ProductVariant, { nullable: true })
  @JoinColumn({ name: 'product_variant_id' })
  variant: ProductVariant | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'purchase_price', type: 'decimal', precision: 10, scale: 2 })
  purchasePrice: string;

  @Column({ name: 'landed_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  landedCost: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: string;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
