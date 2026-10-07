import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Laravel Sanctum's token table. Customers stay signed in across the switch
 * from Laravel because tokens are validated exactly the way Sanctum does it
 * (see SanctumTokenService), and new ones are issued in the same format.
 */
@Entity('personal_access_tokens')
export class PersonalAccessToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tokenable_type', type: 'varchar' })
  tokenableType: string;

  @Column({ name: 'tokenable_id', type: 'int' })
  tokenableId: number;

  @Column({ type: 'text' })
  name: string;

  /** sha256 of the plain-text token. */
  @Column({ type: 'varchar', length: 64 })
  token: string;

  @Column({ type: 'text', nullable: true })
  abilities: string | null;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
