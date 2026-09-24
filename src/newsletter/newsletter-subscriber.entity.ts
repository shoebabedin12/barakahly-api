import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('newsletter_subscribers')
export class NewsletterSubscriber {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ name: 'subscribed_at', type: 'timestamp', nullable: true })
  subscribedAt: Date | null;
}
