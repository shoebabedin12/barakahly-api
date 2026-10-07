import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Maps to the `payment_methods` table owned by the Laravel app's migrations.
 * This entity is read-mostly here; schema changes still happen on the
 * Laravel side (see barakahly-commerce/database/migrations).
 */
@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  code: string;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'requires_transaction_id', type: 'boolean', default: false })
  requiresTransactionId: boolean;

  @Column({ name: 'receiving_number', type: 'text', nullable: true })
  receivingNumber: string | null;

  @Column({ name: 'created_at', type: 'timestamp', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;
}
