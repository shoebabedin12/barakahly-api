import './load-env.js';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { laravelValidationFactory } from './common/laravel-validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Behind Nginx (and Cloudflare): trust X-Forwarded-For for throttling.
  app.getHttpAdapter().getInstance().set('trust proxy', 'loopback');
  app.enableCors();
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
