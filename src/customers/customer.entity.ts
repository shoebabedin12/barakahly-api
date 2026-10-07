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

  /** Profile photo, relative to the public storage disk (avatars/...). */
  @Column({ type: 'varchar', nullable: true })
  avatar: string | null;

  /** Bcrypt hash (Laravel's `hashed` cast). Never selected unless asked for. */
  @Column({ type: 'varchar', nullable: true, select: false })
  password: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
