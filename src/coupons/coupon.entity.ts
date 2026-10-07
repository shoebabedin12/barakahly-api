import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn()
  id: number;

  /** Always stored upper-case. */
  @Column({ type: 'varchar' })
  code: string;

  @Column({ type: 'enum', enum: ['fixed', 'percentage'] })
  type: 'fixed' | 'percentage';

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: string;

  @Column({
    name: 'min_order_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  minOrderAmount: string;

  @Column({
    name: 'max_discount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maxDiscount: string | null;

  /** Y-m-d. */
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

/** CheckoutController's discount formula: percentage capped by max_discount, or a flat amount. */
export function couponDiscount(coupon: Coupon, subtotal: number): number {
  const value = Number(coupon.value);
  if (coupon.type === 'percentage') {
    const max = Number(coupon.maxDiscount) || Number.MAX_VALUE;
    return Math.min((subtotal * value) / 100, max);
  }
  return value;
}
