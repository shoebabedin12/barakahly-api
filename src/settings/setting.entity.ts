import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Maps to the `settings` table (single-row config, see Laravel's
 * Setting::current()). Only a subset of these columns is ever safe to
 * expose over the public API - see PublicSettingResource in the Laravel
 * app and settings.service.ts here. The mail_* columns hold SMTP
 * credentials and must never be serialized in an HTTP response.
 *
 * Every nullable string column below needs an explicit `type: 'varchar'`
 * (or 'text'/'datetime' etc.) - TypeScript's emitted decorator metadata
 * collapses a `string | null` property type to `Object`, which TypeORM
 * rejects with DataTypeNotSupportedError if left to infer it.
 */
@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'site_name', type: 'varchar' })
  siteName: string;

  @Column({ name: 'site_logo', type: 'varchar', nullable: true })
  siteLogo: string | null;

  @Column({ name: 'site_favicon', type: 'varchar', nullable: true })
  siteFavicon: string | null;

  @Column({ name: 'contact_email', type: 'varchar', nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', nullable: true })
  contactPhone: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'shipping_charge', type: 'decimal', precision: 10, scale: 2 })
  shippingCharge: string;

  @Column({ type: 'varchar' })
  currency: string;

  @Column({ type: 'varchar', nullable: true })
  facebook: string | null;

  @Column({ name: 'facebook_pixel_id', type: 'varchar', nullable: true })
  facebookPixelId: string | null;

  @Column({ name: 'clarity_project_id', type: 'varchar', nullable: true })
  clarityProjectId: string | null;

  @Column({ name: 'gtm_id', type: 'varchar', nullable: true })
  gtmId: string | null;

  @Column({ type: 'varchar', nullable: true })
  instagram: string | null;

  @Column({ type: 'varchar', nullable: true })
  youtube: string | null;

  @Column({ type: 'varchar', nullable: true })
  whatsapp: string | null;

  @Column({ name: 'meta_title', type: 'varchar', nullable: true })
  metaTitle: string | null;

  @Column({ name: 'meta_description', type: 'text', nullable: true })
  metaDescription: string | null;

  @Column({ name: 'flash_deal_ends_at', type: 'datetime', nullable: true })
  flashDealEndsAt: Date | null;

  @Column({ name: 'maintenance_mode', type: 'boolean', default: false })
  maintenanceMode: boolean;

  @Column({ name: 'mail_host', type: 'varchar', nullable: true })
  mailHost: string | null;

  @Column({ name: 'mail_port', type: 'varchar', nullable: true })
  mailPort: string | null;

  @Column({ name: 'mail_encryption', type: 'varchar', nullable: true })
  mailEncryption: string | null;

  @Column({ name: 'mail_username', type: 'varchar', nullable: true })
  mailUsername: string | null;

  @Column({ name: 'mail_password', type: 'varchar', nullable: true })
  mailPassword: string | null;

  @Column({ name: 'mail_from_address', type: 'varchar', nullable: true })
  mailFromAddress: string | null;

  @Column({ name: 'mail_from_name', type: 'varchar', nullable: true })
  mailFromName: string | null;

  @Column({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;
}
