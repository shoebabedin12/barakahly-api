import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategoryLandingPages1790000000000 implements MigrationInterface {
  name = 'CreateCategoryLandingPages1790000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`category_landing_pages\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`category_id\` bigint unsigned NOT NULL,
        \`is_active\` tinyint(1) NOT NULL DEFAULT 0,
        \`content\` json NOT NULL,
        \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`category_landing_pages_category_id_unique\` (\`category_id\`),
        CONSTRAINT \`category_landing_pages_category_id_foreign\`
          FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `category_landing_pages`');
  }
}
