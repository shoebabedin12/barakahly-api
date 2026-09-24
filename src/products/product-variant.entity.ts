import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Color } from '../colors/color.entity.js';
import { Size } from '../sizes/size.entity.js';
import { Product } from './product.entity.js';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_id', type: 'int' })
  productId: number;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product>;

  @Column({ name: 'color_id', type: 'int', nullable: true })
  colorId: number | null;

  @ManyToOne(() => Color, { nullable: true })
  @JoinColumn({ name: 'color_id' })
  color: Color | null;

  @Column({ name: 'size_id', type: 'int', nullable: true })
  sizeId: number | null;

  @ManyToOne(() => Size, { nullable: true })
  @JoinColumn({ name: 'size_id' })
  size: Size | null;

  @Column({ type: 'varchar', nullable: true })
  sku: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: string | null;

  @Column({ name: 'discount_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  discountPrice: string | null;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'varchar', nullable: true })
  image: string | null;

  @Column({ type: 'boolean', default: true })
  status: boolean;
}
