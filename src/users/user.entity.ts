import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../roles/role.entity.js';

/**
 * Maps to the `users` table - Laravel's admin/staff accounts (the `web`
 * session guard), a completely separate table from `customers` (the
 * storefront's Sanctum-token accounts). Password hashes are bcrypt
 * ($2y$...), produced by Laravel's Hash facade - bcryptjs verifies these
 * natively, no re-hashing needed.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'role_id', type: 'int', nullable: true })
  roleId: number | null;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'role_id' })
  role: Role | null;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  // Never selected by default - mirrors Laravel's $hidden = ['password', ...].
  @Column({ type: 'varchar', select: false })
  password: string;
}
