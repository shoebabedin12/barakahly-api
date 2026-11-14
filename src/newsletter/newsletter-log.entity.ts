import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** One email sent to a subscriber - part of a broadcast (batch_id set) or an individual send. */
@Entity('newsletter_logs')
export class NewsletterLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'newsletter_subscriber_id', type: 'int', nullable: true })
  subscriberId: number | null;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  subject: string;

  @Column({ type: 'varchar' })
  type: 'broadcast' | 'individual';

  @Column({ name: 'batch_id', type: 'varchar', nullable: true })
  batchId: string | null;

  @Column({ type: 'varchar' })
  status: 'sent' | 'failed';

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
