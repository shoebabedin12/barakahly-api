import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Category } from '../categories/category.entity.js';
import { assetUrl } from '../common/asset-url.js';
import { Product } from '../products/product.entity.js';
import { CategoryLandingPage } from './category-landing-page.entity.js';
import { DEFAULT_LANDING_CONTENT, type LandingContent, sanitizeLandingContent } from './landing-content.js';

/** Same fields as the storefront's ProductListItem (Laravel's
 * ProductListResource), so the landing page can reuse ProductCard. */
export interface ProductCardData {
  id: number;
  name: string;
  slug: string;
  sku: string;
  price: number;
  discount_price: number | null;
  in_stock: boolean;
  stock: number;
  image: string | null;
  category: { id: number; name: string } | null;
  average_rating: number;
  reviews_count: number;
  has_variants: boolean;
  colors_count: number;
}

@Injectable()
export class CategoryLandingsService {
  constructor(
    @InjectRepository(CategoryLandingPage)
    private readonly landings: Repository<CategoryLandingPage>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  // ---- Admin ------------------------------------------------------------

  async adminIndex() {
    const [categories, landings] = await Promise.all([
      this.categories.find({ order: { name: 'ASC' } }),
      this.landings.find(),
    ]);
    const byCategory = new Map(landings.map((l) => [l.categoryId, l]));

    return categories.map((c) => {
      const landing = byCategory.get(c.id);
      return {
        category: { id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, status: c.status },
        hasLanding: !!landing,
        isActive: landing?.isActive ?? false,
        accent: landing?.content.theme.accent ?? null,
        updatedAt: landing?.updatedAt ?? null,
      };
    });
  }

  async adminShow(categoryId: number) {
    const category = await this.findCategory(categoryId);
    const landing = await this.landings.findOne({ where: { categoryId } });
    const content = landing ? sanitizeLandingContent(landing.content) : DEFAULT_LANDING_CONTENT;

    return {
      category: { id: category.id, name: category.name, slug: category.slug },
      isActive: landing?.isActive ?? false,
      content,
      imageUrls: this.imageUrls(content),
      products: await this.categoryProductOptions(categoryId),
    };
  }

  async adminSave(categoryId: number, isActive: boolean, rawContent: unknown) {
    await this.findCategory(categoryId);
    const content = sanitizeLandingContent(rawContent);

    const existing = await this.landings.findOne({ where: { categoryId } });
    if (existing) {
      existing.isActive = isActive;
      existing.content = content;
      await this.landings.save(existing);
    } else {
      await this.landings.save(this.landings.create({ categoryId, isActive, content }));
    }

    return this.adminShow(categoryId);
  }

  uploadedImage(file: Express.Multer.File) {
    const path = `category-landings/${file.filename}`;
    return { path, url: assetUrl(path) };
  }

  // ---- Storefront ---------------------------------------------------------

  async publicShow(slug: string) {
    const category = await this.categories.findOne({ where: { slug, status: true } });
    const landing = category
      ? await this.landings.findOne({ where: { categoryId: category.id, isActive: true } })
      : null;

    if (!category || !landing) {
      throw new NotFoundException('No landing page for this category.');
    }

    const content = sanitizeLandingContent(landing.content);
    const categoryIds = await this.categoryAndChildIds(category.id);

    const featuredIds =
      content.featured.mode === 'manual' && content.featured.productIds.length
        ? content.featured.productIds
        : await this.bestSellerIds(categoryIds, content.featured.limit);

    const [featuredProducts, collageImages, subcategories] = await Promise.all([
      content.featured.enabled ? this.productCards(featuredIds) : Promise.resolve([]),
      content.hero.image ? Promise.resolve([]) : this.collageImages(categoryIds),
      this.categories.find({ where: { parentId: category.id, status: true }, order: { name: 'ASC' } }),
    ]);

    const productCount = await this.products.count({ where: { categoryId: In(categoryIds), status: true } });

    return {
      data: {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          productCount,
        },
        theme: content.theme,
        hero: { ...content.hero, imageUrl: assetUrl(content.hero.image), collage: collageImages },
        highlights: content.highlights,
        featured: { ...content.featured, products: featuredProducts },
        promo: { ...content.promo, imageUrl: assetUrl(content.promo.image) },
        story: content.story,
        subcategories: subcategories.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
      },
    };
  }

  // ---- Helpers ------------------------------------------------------------

  private async findCategory(id: number) {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found.');
    return category;
  }

  private imageUrls(content: LandingContent) {
    return { hero: assetUrl(content.hero.image), promo: assetUrl(content.promo.image) };
  }

  private async categoryAndChildIds(categoryId: number) {
    const children = await this.categories.find({ where: { parentId: categoryId }, select: { id: true } });
    return [categoryId, ...children.map((c) => c.id)];
  }

  private async categoryProductOptions(categoryId: number) {
    const ids = await this.categoryAndChildIds(categoryId);
    const rows: { id: number; name: string; sku: string; status: number; image: string | null }[] =
      await this.products.manager.query(
        `SELECT p.id, p.name, p.sku, p.status,
           (SELECT pi.image FROM product_images pi WHERE pi.product_id = p.id
            ORDER BY pi.is_primary DESC, pi.sort_order, pi.id LIMIT 1) AS image
         FROM products p WHERE p.category_id IN (?) ORDER BY p.name`,
        [ids],
      );
    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      sku: r.sku,
      active: !!Number(r.status),
      image: assetUrl(r.image),
    }));
  }

  /** Active products ranked by units sold, then newest, to fill `limit`. */
  private async bestSellerIds(categoryIds: number[], limit: number): Promise<number[]> {
    const rows: { id: number }[] = await this.products.manager.query(
      `SELECT p.id FROM products p
       LEFT JOIN (SELECT product_id, SUM(quantity) AS sold FROM order_items GROUP BY product_id) s
         ON s.product_id = p.id
       WHERE p.category_id IN (?) AND p.status = 1
       ORDER BY COALESCE(s.sold, 0) DESC, p.created_at DESC
       LIMIT ?`,
      [categoryIds, limit],
    );
    // bigint ids come back from raw queries as strings
    return rows.map((r) => Number(r.id));
  }

  private async collageImages(categoryIds: number[]): Promise<string[]> {
    const rows: { image: string }[] = await this.products.manager.query(
      `SELECT (SELECT pi.image FROM product_images pi WHERE pi.product_id = p.id
                ORDER BY pi.is_primary DESC, pi.sort_order, pi.id LIMIT 1) AS image
       FROM products p WHERE p.category_id IN (?) AND p.status = 1
       ORDER BY p.created_at DESC LIMIT 12`,
      [categoryIds],
    );
    // The hero is the first thing shoppers see, so skip products whose image
    // file is missing from disk rather than show a broken picture there.
    const productsDir = process.env.LARAVEL_PUBLIC_STORAGE_PATH;
    const storageRoot = productsDir ? dirname(productsDir) : null;

    return rows
      .filter((r) => r.image && (!storageRoot || existsSync(join(storageRoot, r.image))))
      .map((r) => assetUrl(r.image))
      .filter((url): url is string => !!url)
      .slice(0, 3);
  }

  /** Builds ProductListItem-shaped cards for `ids`, keeping their order and
   * skipping inactive/missing products. */
  private async productCards(ids: number[]): Promise<ProductCardData[]> {
    if (!ids.length) return [];

    const products = await this.products.find({
      where: { id: In(ids), status: true },
      relations: { category: true, images: true, variants: true },
    });

    const ratings: { product_id: number; avg: string; total: string }[] = await this.products.manager.query(
      `SELECT product_id, AVG(rating) AS avg, COUNT(*) AS total FROM reviews
       WHERE status = 1 AND product_id IN (?) GROUP BY product_id`,
      [ids],
    );
    const ratingBy = new Map(ratings.map((r) => [Number(r.product_id), r]));
    const byId = new Map(products.map((p) => [p.id, p]));

    return ids
      .map((id) => byId.get(id))
      .filter((p): p is Product => !!p)
      .map((p) => {
        const image =
          p.images.find((i) => i.isPrimary) ??
          [...p.images].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)[0];
        const stock = p.variants.length ? p.variants.reduce((sum, v) => sum + v.stock, 0) : p.stock;
        const rating = ratingBy.get(p.id);

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          price: Number(p.price),
          discount_price: p.discountPrice ? Number(p.discountPrice) : null,
          in_stock: stock > 0,
          stock,
          image: assetUrl(image?.image ?? null),
          category: p.category ? { id: p.category.id, name: p.category.name } : null,
          average_rating: rating ? Number(rating.avg) : 0,
          reviews_count: rating ? Number(rating.total) : 0,
          has_variants: p.variants.length > 0,
          colors_count: new Set(p.variants.map((v) => v.colorId).filter(Boolean)).size,
        };
      });
  }
}
