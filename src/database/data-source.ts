import { DataSource } from 'typeorm';

// Used only by the TypeORM CLI (`npm run migration:run`); the app itself
// connects through TypeOrmModule in app.module.ts.
try {
  process.loadEnvFile();
} catch {
  // no .env - rely on the real environment
}

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'barakahly',
  // Laravel already uses the `migrations` table name in this database.
  migrationsTableName: 'typeorm_migrations',
  timezone: 'Z',
  bigNumberStrings: false,
  migrations: [new URL('./migrations/*.js', import.meta.url).pathname],
});
