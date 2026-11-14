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
  location: string | null;

  @Column({ type: 'varchar', nullable: true })
  device: string | null;

  @Column({ type: 'varchar', nullable: true })
  browser: string | null;

  @Column({ name: 'operating_system', type: 'varchar', nullable: true })
  operatingSystem: string | null;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ type: 'varchar', nullable: true })
  campaign: string | null;

  @Column({ name: 'subscribed_at', type: 'timestamp', nullable: true })
  subscribedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamp', nullable: true })
  createdAt: Date | null;
}
