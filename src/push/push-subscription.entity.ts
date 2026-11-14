import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** An admin browser that asked for new-order notifications (Laravel's table). */
@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ type: 'text' })
  endpoint: string;

  @Column({ name: 'endpoint_hash', type: 'varchar', length: 64 })
  endpointHash: string;

  @Column({ name: 'public_key', type: 'varchar' })
  publicKey: string;

  @Column({ name: 'auth_token', type: 'varchar' })
  authToken: string;

  @Column({ name: 'created_at', type: 'timestamp', nullable: true })
  createdAt: Date | null;

  @Column({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;
}
