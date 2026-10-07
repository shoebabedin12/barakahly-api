import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsRelations, In, Repository } from 'typeorm';
import { assetUrl } from '../common/asset-url.js';
import { ProductImage } from '../products/product-image.entity.js';
import { ProductVariant } from '../products/product-variant.entity.js';
import type { Product } from '../products/product.entity.js';
import { Review } from '../reviews/review.entity.js';

export interface ListItemOptions {
  /** Include `category: {id, name}` (only when Laravel eager-loaded it). */
  withCategory?: boolean;
  /**
   * ProductController@index loads only active variants (so stock and
   * colors_count use them) and counts all variants for has_variants. Every
   * other list (home, wishlist) lazy-loads all variants (for stock and
   * colors_count) and counts active ones for has_variants.
   */
  activeVariantsLoaded?: boolean;
}

export interface ReviewStats {
  average: number;
  count: number;
}

/**
 * Builds ProductListResource / ProductResource payloads. Images, variants and
 * approved-review stats are fetched in one query each for the whole page,
 * rather than per product like Laravel's lazy accessors.
 */
@Injectable()
export class ProductPresenterService {
  constructor(
    @InjectRepository(ProductImage)
    private readonly images: Repository<ProductImage>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
  ) {}

  async imagesFor(productIds: number[]) {
    const map = new Map<number, ProductImage[]>();
    if (!productIds.length) return map;
    const rows = await this.images.find({
      where: { productId: In(productIds) },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    for (const row of rows) {
      map.set(row.productId, [...(map.get(row.productId) ?? []), row]);
    }
    return map;
  }

  async variantsFor(
    productIds: number[],
    relations: FindOptionsRelations<ProductVariant> = {},
  ) {
    const map = new Map<number, ProductVariant[]>();
    if (!productIds.length) return map;
    const rows = await this.variants.find({
      where: { productId: In(productIds) },
      relations,
      // Laravel loads variants unordered, and MySQL then returns them in the
      // (product_id, color_id, size_id) unique-index order.
      order: { colorId: 'ASC', sizeId: 'ASC', id: 'ASC' },
    });
    for (const row of rows) {
      map.set(row.productId, [...(map.get(row.productId) ?? []), row]);
    }
    return map;
  }

  /** Product::getAverageRatingAttribute / getReviewsCountAttribute (approved reviews only). */
  async reviewStatsFor(productIds: number[]) {
    const map = new Map<number, ReviewStats>();
    if (!productIds.length) return map;
    const rows = await this.reviews
      .createQueryBuilder('review')
      .select('review.productId', 'productId')
      .addSelect('AVG(review.rating)', 'average')
      .addSelect('COUNT(*)', 'count')
      .where('review.productId IN (:...ids)', { ids: productIds })
      .andWhere('review.status = 1')
      .groupBy('review.productId')
      .getRawMany<{ productId: number; average: string; count: string }>();
    for (const row of rows) {
      map.set(Number(row.productId), {
        average: Math.round(Number(row.average) * 10) / 10,
        count: Number(row.count),
      });
    }
    return map;
  }

  /** primaryImage (is_primary) first, otherwise the first image by sort order. */
  static primaryImage(images: ProductImage[]) {
    return images.find((image) => image.isPrimary) ?? images[0] ?? null;
  }

  static effectiveStock(product: Product, variants: ProductVariant[]) {
    return variants.length
      ? variants.reduce((sum, v) => sum + v.stock, 0)
      : product.stock;
  }

  /** ProductListResource for a page of products, in the given order. */
  async listItems(products: Product[], options: ListItemOptions = {}) {
    const ids = products.map((p) => p.id);
    const [images, variants, stats] = await Promise.all([
      this.imagesFor(ids),
      this.variantsFor(ids),
      this.reviewStatsFor(ids),
    ]);

    return products.map((product) => {
      const all = variants.get(product.id) ?? [];
      const active = all.filter((v) => v.status);
      const loaded = options.activeVariantsLoaded ? active : all;
      const stock = ProductPresenterService.effectiveStock(product, loaded);
      const image = ProductPresenterService.primaryImage(
        images.get(product.id) ?? [],
      );
      const stat = stats.get(product.id) ?? { average: 0, count: 0 };

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        price: Number(product.price),
        discount_price: product.discountPrice
          ? Number(product.discountPrice)
          : null,
        in_stock: stock > 0,
        stock,
        image: image ? assetUrl(image.image) : null,
        ...(options.withCategory && product.category
          ? {
              category: {
                id: product.category.id,
                name: product.category.name,
              },
            }
          : {}),
        average_rating: stat.average,
        reviews_count: stat.count,
        has_variants: options.activeVariantsLoaded
          ? all.length > 0
          : active.length > 0,
        colors_count: new Set(loaded.map((v) => v.colorId).filter((id) => id))
          .size,
      };
    });
  }
}
