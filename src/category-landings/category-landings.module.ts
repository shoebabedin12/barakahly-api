import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module.js';
import { Category } from '../categories/category.entity.js';
import { Product } from '../products/product.entity.js';
import { CategoryLandingPage } from './category-landing-page.entity.js';
import { AdminCategoryLandingsController, CategoryLandingsController } from './category-landings.controller.js';
import { CategoryLandingsService } from './category-landings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryLandingPage, Category, Product]), AdminAuthModule],
  controllers: [AdminCategoryLandingsController, CategoryLandingsController],
  providers: [CategoryLandingsService],
})
export class CategoryLandingsModule {}
