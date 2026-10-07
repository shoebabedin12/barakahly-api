import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface AbandonedCartLine {
  id: number;
  name: string;
  variant_id: number | null;
  quantity: number;
  subtotal: number;
}

/** Snapshot of a verified guest's cart, cleared (recovered) once they order. */
@Entity('abandoned_carts')
export class AbandonedCart {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'cart_snapshot', type: 'json' })
  cartSnapshot: AbandonedCartLine[];

  @Column({
    name: 'cart_total',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  cartTotal: string;

  @Column({ name: 'reminder_sent_at', type: 'timestamp', nullable: true })
  reminderSentAt: Date | null;

  @Column({ name: 'recovered_at', type: 'timestamp', nullable: true })
  recoveredAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
