import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module.js';
import { Product } from '../products/product.entity.js';
import { FeedsController } from './feeds.controller.js';
import { FeedsService } from './feeds.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), CatalogModule],
  controllers: [FeedsController],
  providers: [FeedsService],
})
export class FeedsModule {}
