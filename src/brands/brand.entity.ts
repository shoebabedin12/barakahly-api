import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('brands')
export class Brand {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  status: boolean;

  // Set explicitly in BrandsService#create - @CreateDateColumn's
  // auto-populate-on-insert wasn't firing with this TypeORM setup.
  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
