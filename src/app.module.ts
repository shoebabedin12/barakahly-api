import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from './admin-auth/admin-auth.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { BrandsModule } from './brands/brands.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CategoryLandingsModule } from './category-landings/category-landings.module.js';
import { CartModule } from './cart/cart.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { LaravelTimestampsSubscriber } from './database/laravel-timestamps.subscriber.js';
import { AppThrottlerGuard } from './common/app-throttler.guard.js';
import { CustomerAuthModule } from './customer-auth/customer-auth.module.js';
import { AccountModule } from './account/account.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { ColorsModule } from './colors/colors.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { NewsletterModule } from './newsletter/newsletter.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PagesModule } from './pages/pages.module.js';
import { ProductsModule } from './products/products.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { SizesModule } from './sizes/sizes.module.js';
import { FeedsModule } from './feeds/feeds.module.js';
import { StoreAdminModule } from './store-admin/store-admin.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: parseInt(config.get<string>('DB_PORT', '3306'), 10),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_DATABASE', 'barakahly'),
        // Laravel writes every timestamp in UTC (config/app.php timezone),
        // so read and write DATETIME/TIMESTAMP values as UTC too - otherwise
        // the server's local offset (+06) shifts every date by six hours.
        timezone: 'Z',
        // BIGINT ids as JS numbers (they're far below 2^53), matching the
        // `number` types on every entity; DECIMALs still arrive as strings.
        bigNumberStrings: false,
        subscribers: [LaravelTimestampsSubscriber],
        autoLoadEntities: true,
        // The existing tables' schema is owned by the Laravel app's
        // migrations. Tables this service adds (e.g. category_landing_pages)
        // come from its own migrations in src/database/migrations, run with
        // `npm run migration:run`. TypeORM must never auto-alter the schema.
        synchronize: false,
      }),
    }),
    CatalogModule,
    CartModule,
    CustomerAuthModule,
    AccountModule,
    CheckoutModule,
    SettingsModule,
    NewsletterModule,
    PagesModule,
    AdminAuthModule,
    CategoriesModule,
    CategoryLandingsModule,
    BrandsModule,
    ColorsModule,
    SizesModule,
    ProductsModule,
    DashboardModule,
    OrdersModule,
    StoreAdminModule,
    FeedsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
