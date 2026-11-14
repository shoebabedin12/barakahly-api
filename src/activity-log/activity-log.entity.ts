import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity.js';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar' })
  action: string;

  /** Laravel model class, e.g. "App\Models\Product" - kept identical so old and new rows read the same. */
  @Column({ name: 'subject_type', type: 'varchar', nullable: true })
  subjectType: string | null;

  @Column({ name: 'subject_id', type: 'int', nullable: true })
  subjectId: number | null;

  @Column({ name: 'subject_label', type: 'varchar', nullable: true })
  subjectLabel: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'json', nullable: true })
  changes: Record<string, unknown> | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
