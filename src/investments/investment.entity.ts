import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('investments')
export class Investment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'investor_name', type: 'varchar' })
  investorName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ name: 'invested_date', type: 'date' })
  investedDate: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
