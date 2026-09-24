import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Investment } from '../investments/investment.entity.js';
import { Supplier } from '../suppliers/supplier.entity.js';

@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id', type: 'int' })
  supplierId: number;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'purchase_number', type: 'varchar' })
  purchaseNumber: string;

  @Column({ name: 'purchase_date', type: 'date' })
  purchaseDate: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: string;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 10, scale: 2 })
  paidAmount: string;

  @Column({ name: 'due_amount', type: 'decimal', precision: 10, scale: 2 })
  dueAmount: string;

  @Column({ name: 'payment_status', type: 'enum', enum: ['unpaid', 'partial', 'paid'] })
  paymentStatus: 'unpaid' | 'partial' | 'paid';

  @Column({ type: 'enum', enum: ['pending', 'completed', 'cancelled'] })
  status: 'pending' | 'completed' | 'cancelled';

  @Column({ name: 'funding_source', type: 'enum', enum: ['business', 'investment'] })
  fundingSource: 'business' | 'investment';

  @Column({ name: 'investment_id', type: 'int', nullable: true })
  investmentId: number | null;

  @ManyToOne(() => Investment, { nullable: true })
  @JoinColumn({ name: 'investment_id' })
  investment: Investment | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
