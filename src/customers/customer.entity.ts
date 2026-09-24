import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Storefront customer accounts - distinct from `users` (admin/staff). */
@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
