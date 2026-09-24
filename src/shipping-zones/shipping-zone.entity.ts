import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Maps to the `shipping_zones` table owned by the Laravel app's migrations. */
@Entity('shipping_zones')
export class ShippingZone {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  charge: string;

  @Column({ type: 'boolean', default: true })
  status: boolean;
}
