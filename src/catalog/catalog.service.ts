import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type SelectQueryBuilder } from 'typeorm';
import { Banner } from '../banners/banner.entity.js';
import { Brand } from '../brands/brand.entity.js';
import { Category } from '../categories/category.entity.js';
import { assetUrl } from '../common/asset-url.js';
import { iso8601 } from '../common/iso-date.js';
import { laravelPaginated, positiveInt } from '../common/laravel-pagination.js';
import { Product } from '../products/product.entity.js';
import { Review } from '../reviews/review.entity.js';
import { byName, categoryIcon } from './category-tree.js';
import { ProductPresenterService } from './product-presenter.service.js';

export interface ProductListQuery {
  search?: string;
  category?: string;
  brand?: string;
  min_price?: string;
  max_price?: string;
  sort?: string;
  per_page?: string;
  page?: string;
}

interface CategoryNode {
  category: Category;
  productsCount: number;
  children: { category: Category; productsCount: number }[];
  totalProductsCount: number;
}

/** Number formatted like PHP number_format($n, 2): "1,234.50". */
function numberFormat(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Public catalog: Api\V1\HomeController and Api\V1\ProductController. */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Brand)
    private readonly brands: Repository<Brand>,
    @InjectRepository(Banner)
    private readonly banners: Repository<Banner>,
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    private readonly presenter: ProductPresenterService,
  ) {}

  // ---------------------------------------------------------------- categories

  /** Category::scopeActiveTopLevelWithProductCounts, with total_products_count. */
  private async activeTopLevelWithCounts(): Promise<CategoryNode[]> {
    const [all, counts] = await Promise.all([
      this.categories.find({ where: { status: true } }),
      this.products
        .createQueryBuilder('product')
        .select('product.categoryId', 'categoryId')
        .addSelect('COUNT(*)', 'count')
        .where('product.status = 1')
        .groupBy('product.categoryId')
        .getRawMany<{ categoryId: number; count: string }>(),
    ]);
    const countOf = new Map(
      counts.map((row) => [Number(row.categoryId), Number(row.count)]),
    );

    return all
      .filter((category) => category.parentId === null)
      .map((category) => {
        const children = all
          .filter((child) => child.parentId === category.id)
          .sort(byName)
          .map((child) => ({
            category: child,
            productsCount: countOf.get(child.id) ?? 0,
          }));
        const productsCount = countOf.get(category.id) ?? 0;
        return {
          category,
          productsCount,
          children,
          totalProductsCount:
            productsCount +
            children.reduce((sum, c) => sum + c.productsCount, 0),
        };
      });
  }

  /** Category::selfAndChildrenIds (direct, active-or-not children, like the relation). */
  private async selfAndChildrenIds(category: Category) {
    const children = await this.categories.find({
      where: { parentId: category.id },
      select: { id: true },
    });
    return [...children.map((child) => child.id), category.id];
  }

  /** Category::resolveCoverImage - first image of the newest active product in the family. */
  private async coverImage(ids: number[]) {
    const product = await this.products.findOne({
      where: { categoryId: In(ids), status: true },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
    if (!product) return null;
    const images =
      (await this.presenter.imagesFor([product.id])).get(product.id) ?? [];
    return images[0]?.image ?? null;
  }

  /** CategoryResource for a node, children included (children never carry a cover). */
  private async presentCategory(node: CategoryNode) {
    const cover = await this.coverImage([
      ...node.children.map((child) => child.category.id),
      node.category.id,
    ]);
    const plain = (category: Category, coverImage: string | null) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: categoryIcon(category.name),
      cover_image: coverImage ? assetUrl(coverImage) : null,
    });

    return {
      ...plain(node.category, cover),
      children: node.children.map((child) => plain(child.category, null)),
    };
  }

  async categoriesIndex() {
    const nodes = (await this.activeTopLevelWithCounts())
      .filter((node) => node.totalProductsCount > 0)
      .sort((a, b) => byName(a.category, b.category));
    return {
      data: await Promise.all(nodes.map((node) => this.presentCategory(node))),
    };
  }

  /** GET categories/{category}/preview - route model binding by id. */
  async categoryPreview(categoryId: string) {
    const category = /^\d+$/.test(categoryId)
      ? await this.categories.findOneBy({ id: Number(categoryId) })
      : null;
    if (!category) throw new NotFoundException({ message: 'Not Found' });

    const products = await this.products.find({
      where: {
        categoryId: In(await this.selfAndChildrenIds(category)),
        status: true,
      },
      order: { createdAt: 'DESC', id: 'ASC' },
      take: 4,
    });
    return this.suggestionRows(products);
  }

  private async suggestionRows(products: Product[]) {
    const images = await this.presenter.imagesFor(products.map((p) => p.id));
    return products.map((product) => {
      const first = images.get(product.id)?.[0];
      return {
        name: product.name,
        slug: product.slug,
        image: first ? assetUrl(first.image) : null,
        price: numberFormat(Number(product.discountPrice ?? product.price)),
      };
    });
  }

  // ------------------------------------------------------------------ products

  async brandsIndex() {
    const brands = await this.brands.find({
      where: { status: true },
      order: { name: 'ASC' },
      select: { id: true, name: true },
    });
    return {
      data: brands.map((brand) => ({ id: brand.id, name: brand.name })),
    };
  }

  async suggestions(q: string | undefined) {
    const query = (q ?? '').trim();
    if (!query) return [];

    const products = await this.products
      .createQueryBuilder('product')
      .where('product.status = 1')
      .andWhere('(product.name LIKE :like OR product.sku LIKE :like)', {
        like: `%${query}%`,
      })
      .take(6)
      .getMany();
    return this.suggestionRows(products);
  }

  async productsIndex(query: ProductListQuery) {
    const base = async () => {
      const qb = this.products
        .createQueryBuilder('product')
        .where('product.status = 1');
      if (query.search) {
        qb.andWhere('(product.name LIKE :like OR product.sku LIKE :like)', {
          like: `%${query.search}%`,
        });
      }
      if (query.category) {
        const category = await this.categories.findOneBy({
          slug: query.category,
        });
        const ids = category ? await this.selfAndChildrenIds(category) : [];
        if (ids.length)
          qb.andWhere('product.categoryId IN (:...categoryIds)', {
            categoryIds: ids,
          });
        else qb.andWhere('1 = 0');
      }
      if (query.brand)
        qb.andWhere('product.brandId = :brand', { brand: query.brand });
      return qb;
    };

    // Price bounds follow search/category/brand but not the price filter itself.
    const bounds = await (
      await base()
    )
      .select('MIN(product.price)', 'min')
      .addSelect('MAX(product.price)', 'max')
      .getRawOne<{ min: string | null; max: string | null }>();
    const priceMin = Math.floor(Number(bounds?.min ?? 0));
    let priceMax = Math.ceil(Number(bounds?.max ?? 0));
    if (priceMax <= priceMin) priceMax = priceMin + 1;

    const qb: SelectQueryBuilder<Product> = (await base()).leftJoinAndSelect(
      'product.category',
      'category',
    );
    if (query.min_price)
      qb.andWhere('product.price >= :minPrice', { minPrice: query.min_price });
    if (query.max_price)
      qb.andWhere('product.price <= :maxPrice', { maxPrice: query.max_price });

    switch (query.sort) {
      case 'price_asc':
        qb.orderBy('product.price', 'ASC');
        break;
      case 'price_desc':
        qb.orderBy('product.price', 'DESC');
        break;
      case 'name':
        qb.orderBy('product.name', 'ASC');
        break;
      default:
        qb.orderBy('product.createdAt', 'DESC');
    }
    // Ties keep MySQL's natural (id) order, which is what Laravel's latest() gets.
    qb.addOrderBy('product.id', 'ASC');

    const perPage = positiveInt(query.per_page, 12, 100);
    const page = positiveInt(query.page, 1);
    const [products, total] = await qb
      .skip((page - 1) * perPage)
      .take(perPage)
      .getManyAndCount();

    const items = await this.presenter.listItems(products, {
      withCategory: true,
      activeVariantsLoaded: true,
    });

    return {
      ...laravelPaginated(items, {
        page,
        perPage,
        total,
        path: '/api/v1/products',
      }),
      price_range: { min: priceMin, max: priceMax },
    };
  }

  /** ProductResource for one active product. */
  async productShow(slug: string) {
    const product = await this.products.findOne({
      where: { slug, status: true },
      relations: { category: true, brand: true },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'No query results for model [App\\Models\\Product].',
      });
    }

    const [images, variantMap, stats, reviews] = await Promise.all([
      this.presenter.imagesFor([product.id]),
      this.presenter.variantsFor([product.id], { color: true, size: true }),
      this.presenter.reviewStatsFor([product.id]),
      this.reviews.find({
        where: { productId: product.id, status: true },
        relations: { customer: true },
        order: { createdAt: 'DESC', id: 'ASC' },
      }),
    ]);
    const variants = (variantMap.get(product.id) ?? []).filter((v) => v.status);
    const stock = ProductPresenterService.effectiveStock(product, variants);
    const stat = stats.get(product.id) ?? { average: 0, count: 0 };

    const uniqueBy = <T extends { id: number }>(list: (T | null)[]) => {
      const seen = new Set<number>();
      return list.filter((item): item is T => {
        if (!item || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };

    return {
      data: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        description: product.description,
        price: Number(product.price),
        discount_price: product.discountPrice
          ? Number(product.discountPrice)
          : null,
        stock,
        in_stock: stock > 0,
        average_rating: stat.average,
        reviews_count: stat.count,
        category: product.category
          ? { id: product.category.id, name: product.category.name }
          : null,
        brand: product.brand
          ? { id: product.brand.id, name: product.brand.name }
          : null,
        images: (images.get(product.id) ?? []).map((image) =>
          assetUrl(image.image),
        ),
        colors: uniqueBy(variants.map((v) => v.color)).map((color) => ({
          id: color.id,
          name: color.name,
          hex_code: color.hexCode,
          image: color.image ? assetUrl(color.image) : null,
        })),
        sizes: uniqueBy(variants.map((v) => v.size)).map((size) => ({
          id: size.id,
          name: size.name,
        })),
        variants: variants.map((variant) => ({
          id: variant.id,
          color_id: variant.colorId,
          size_id: variant.sizeId,
          price: Number(variant.price),
          discount_price: variant.discountPrice
            ? Number(variant.discountPrice)
            : null,
          stock: variant.stock,
          image: variant.image ? assetUrl(variant.image) : null,
        })),
        reviews: reviews.map((review) => ({
          id: review.id,
          customer_name: review.customer.name,
          rating: review.rating,
          comment: review.comment,
          created_at: iso8601(review.createdAt),
        })),
      },
    };
  }

  // ---------------------------------------------------------------------- home

  async home() {
    const [banners, featured, flashCandidates, bestSellerRows, nodes] =
      await Promise.all([
        this.banners.find({
          where: { status: true },
          order: { sortOrder: 'ASC', id: 'ASC' },
        }),
        this.products.find({
          where: { status: true },
          relations: { category: true },
          order: { createdAt: 'DESC', id: 'ASC' },
          take: 8,
        }),
        this.products
          .createQueryBuilder('product')
          .where('product.status = 1')
          .andWhere('product.discountPrice IS NOT NULL')
          .getMany(),
        this.products
          .createQueryBuilder('product')
          .select('product.id', 'id')
          .addSelect(
            '(SELECT COUNT(*) FROM order_items oi WHERE oi.product_id = product.id)',
            'orderItemsCount',
          )
          .where('product.status = 1')
          .orderBy('orderItemsCount', 'DESC')
          .limit(8)
          .getRawMany<{ id: number; orderItemsCount: string }>(),
        this.activeTopLevelWithCounts(),
      ]);

    const discountRatio = (p: Product) =>
      Number(p.price) > 0
        ? (Number(p.price) - Number(p.discountPrice)) / Number(p.price)
        : 0;
    const flashDeals = flashCandidates
      .sort((a, b) => discountRatio(b) - discountRatio(a))
      .slice(0, 8);

    const bestIds = bestSellerRows
      .filter((row) => Number(row.orderItemsCount) > 0)
      .map((row) => Number(row.id));
    const bestProducts = bestIds.length
      ? await this.products.find({
          where: { id: In(bestIds) },
          relations: { category: true },
        })
      : [];
    const bestSellers = bestIds
      .map((id) => bestProducts.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p));

    const topCategories = nodes
      .filter((node) => node.totalProductsCount > 0)
      .sort((a, b) => b.totalProductsCount - a.totalProductsCount)
      .slice(0, 8);

    return {
      banners: banners.map((banner) => ({
        id: banner.id,
        title: banner.title,
        subtitle: banner.subtitle,
        image: assetUrl(banner.image),
        button_text: banner.buttonText,
        button_link: banner.buttonLink,
        // Not in the Laravel response: lets the storefront place promo banners separately.
        position: banner.position,
      })),
      categories: await Promise.all(
        topCategories.map((node) => this.presentCategory(node)),
      ),
      featured_products: await this.presenter.listItems(featured, {
        withCategory: true,
      }),
      flash_deals: await this.presenter.listItems(flashDeals),
      best_sellers: await this.presenter.listItems(bestSellers, {
        withCategory: true,
      }),
    };
  }
}
