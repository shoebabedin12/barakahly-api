import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Customer } from '../customers/customer.entity.js';
import { PaymentMethod } from '../payment-methods/payment-method.entity.js';
import { ShippingZone } from '../shipping-zones/shipping-zone.entity.js';
import { OrderItem } from './order-item.entity.js';
import { OrderStatusHistory } from './order-status-history.entity.js';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_number', type: 'varchar' })
  orderNumber: string;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId: number | null;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ name: 'shipping_zone_id', type: 'int', nullable: true })
  shippingZoneId: number | null;

  @ManyToOne(() => ShippingZone, { nullable: true })
  @JoinColumn({ name: 'shipping_zone_id' })
  shippingZone: ShippingZone | null;

  @Column({ name: 'payment_method_id', type: 'int', nullable: true })
  paymentMethodId: number | null;

  @ManyToOne(() => PaymentMethod, { nullable: true })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethodRef: PaymentMethod | null;

  @Column({ name: 'payment_method', type: 'varchar', nullable: true })
  paymentMethod: string | null;

  @Column({ name: 'payment_gateway', type: 'varchar', nullable: true })
  paymentGateway: string | null;

  @Column({ name: 'transaction_id', type: 'varchar', nullable: true })
  transactionId: string | null;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate: string | null;

  @Column({ name: 'coupon_code', type: 'varchar', nullable: true })
  couponCode: string | null;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2 })
  discountAmount: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: string;

  @Column({ name: 'shipping_charge', type: 'decimal', precision: 10, scale: 2 })
  shippingCharge: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: string;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: ['pending', 'paid', 'failed', 'refunded'],
  })
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';

  @Column({
    name: 'order_status',
    type: 'enum',
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
  })
  orderStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

  @Column({ name: 'shipping_address', type: 'text' })
  shippingAddress: string;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: Relation<OrderItem>[];

  @OneToMany(() => OrderStatusHistory, (history) => history.order)
  statusHistories: Relation<OrderStatusHistory>[];
}
