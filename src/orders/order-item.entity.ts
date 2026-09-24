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
import { Order } from './order.entity.js';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Relation<Order>;

  @Column({ name: 'product_id', type: 'int', nullable: true })
  productId: number | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product> | null;

  @Column({ name: 'product_variant_id', type: 'int', nullable: true })
  productVariantId: number | null;

  @ManyToOne(() => ProductVariant, { nullable: true })
  @JoinColumn({ name: 'product_variant_id' })
  variant: Relation<ProductVariant> | null;

  @Column({ name: 'product_name', type: 'varchar' })
  productName: string;

  @Column({ name: 'variant_color', type: 'varchar', nullable: true })
  variantColor: string | null;

  @Column({ name: 'variant_size', type: 'varchar', nullable: true })
  variantSize: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: string;
}
