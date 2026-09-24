import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Brand } from '../brands/brand.entity.js';
import { Category } from '../categories/category.entity.js';
import { ProductImage } from './product-image.entity.js';
import { ProductVariant } from './product-variant.entity.js';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id', type: 'int' })
  categoryId: number;

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'brand_id', type: 'int', nullable: true })
  brandId: number | null;

  @ManyToOne(() => Brand, { nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'varchar', unique: true })
  sku: string;

  @Column({ name: 'source_reference', type: 'varchar', nullable: true })
  sourceReference: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @Column({ name: 'discount_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  discountPrice: string | null;

  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  costPrice: string | null;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // No `image` column here - it was dropped in favor of the
  // product_images table (see 2026_07_24_075640_drop_image_column_...).

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => ProductImage, (image) => image.product)
  images: Relation<ProductImage>[];

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: Relation<ProductVariant>[];
}
