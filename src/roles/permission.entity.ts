import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A named capability (manage-products, view-reports...) roles can be given. */
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  slug: string;
}
