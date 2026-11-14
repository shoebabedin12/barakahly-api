import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets a purchase line target one colour/size variant, so receiving stock
 * for a product with variants lands on the variant stock the storefront
 * actually sells from. NULL keeps the old behaviour (base product stock).
 */
export class AddVariantToPurchaseItems1791920000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`purchase_items\`
        ADD COLUMN \`product_variant_id\` bigint unsigned NULL AFTER \`product_id\`,
        ADD CONSTRAINT \`purchase_items_product_variant_id_foreign\`
          FOREIGN KEY (\`product_variant_id\`) REFERENCES \`product_variants\` (\`id\`) ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `purchase_items` DROP FOREIGN KEY `purchase_items_product_variant_id_foreign`',
    );
    await queryRunner.query('ALTER TABLE `purchase_items` DROP COLUMN `product_variant_id`');
  }
}
