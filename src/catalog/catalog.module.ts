import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Banner } from '../banners/banner.entity.js';
import { Brand } from '../brands/brand.entity.js';
import { Category } from '../categories/category.entity.js';
import { ProductImage } from '../products/product-image.entity.js';
import { ProductVariant } from '../products/product-variant.entity.js';
import { Product } from '../products/product.entity.js';
import { Review } from '../reviews/review.entity.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { ProductPresenterService } from './product-presenter.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductImage,
      ProductVariant,
      Category,
      Brand,
      Banner,
      Review,
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService, ProductPresenterService],
  exports: [ProductPresenterService],
})
export class CatalogModule {}
