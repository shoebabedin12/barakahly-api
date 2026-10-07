import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService, type ProductListQuery } from './catalog.service.js';

/** Mirrors Api\V1\HomeController and Api\V1\ProductController (public catalog). */
@Controller('api/v1')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('home')
  home() {
    return this.catalog.home();
  }

  @Get('products')
  products(@Query() query: ProductListQuery) {
    return this.catalog.productsIndex(query);
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.catalog.productShow(slug);
  }

  @Get('categories')
  categories() {
    return this.catalog.categoriesIndex();
  }

  @Get('categories/:category/preview')
  categoryPreview(@Param('category') category: string) {
    return this.catalog.categoryPreview(category);
  }

  @Get('brands')
  brands() {
    return this.catalog.brandsIndex();
  }

  @Get('search/suggestions')
  suggestions(@Query('q') q?: string) {
    return this.catalog.suggestions(q);
  }
}
