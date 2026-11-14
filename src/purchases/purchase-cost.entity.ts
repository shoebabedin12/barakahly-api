import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { Purchase } from './purchase.entity.js';

/** Purchase-level extra cost (shipping, customs, handling...), spread over the items' landed cost. */
@Entity('purchase_costs')
export class PurchaseCost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'purchase_id', type: 'int' })
  purchaseId: number;

  @ManyToOne('Purchase', (purchase: Purchase) => purchase.costs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase: Relation<Purchase>;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ name: 'cost_date', type: 'date' })
  costDate: string;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
