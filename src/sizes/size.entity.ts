import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sizes')
export class Size {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
