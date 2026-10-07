import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** What this service keeps in `passkeys.credential` for each registered passkey. */
export interface StoredPasskeyCredential {
  /** COSE public key, base64url. */
  publicKey: string;
  counter: number;
  transports?: string[];
  aaguid?: string;
}

/**
 * Customer passkeys. The table comes from the laravel/passkeys migration,
 * whose `user_id` column points at `customers` despite its name.
 */
@Entity('passkeys')
export class Passkey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  customerId: number;

  @Column({ type: 'varchar' })
  name: string;

  /** base64url credential id, as sent by the browser. */
  @Column({ name: 'credential_id', type: 'varchar' })
  credentialId: string;

  @Column({ type: 'json' })
  credential: StoredPasskeyCredential;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
