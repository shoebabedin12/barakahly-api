import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Profile photo for storefront customers (path under the public storage disk). */
export class AddCustomerAvatar1791400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `customers` ADD COLUMN `avatar` varchar(255) NULL AFTER `email`',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `customers` DROP COLUMN `avatar`');
  }
}
