import './load-env.js';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'node:path';
import { AppModule } from './app.module.js';
import { laravelValidationFactory } from './common/laravel-validation.js';
import { publicStorageRoot } from './common/public-storage.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind Nginx (and Cloudflare): trust X-Forwarded-For for throttling.
  app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');
  app.enableCors();
  // Uploaded files at /storage. In production Nginx serves them before they
  // reach Node; this is what serves them in local dev now that Laravel's
  // `php artisan serve` is gone.
  app.useStaticAssets(resolve(publicStorageRoot()), {
    prefix: '/storage/',
    dotfiles: 'ignore',
    index: false,
    fallthrough: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: laravelValidationFactory,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
