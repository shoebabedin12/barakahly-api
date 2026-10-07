import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Home page hero slides. */
@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar', nullable: true })
  subtitle: string | null;

  /** Path under storage/app/public (banners/...). */
  @Column({ type: 'varchar' })
  image: string;

  @Column({ type: 'varchar', default: 'hero' })
  position: string;

  @Column({ name: 'button_text', type: 'varchar', nullable: true })
  buttonText: string | null;

  @Column({ name: 'button_link', type: 'varchar', nullable: true })
  buttonLink: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  status: boolean;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
