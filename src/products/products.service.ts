import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource, In, Not, Repository } from 'typeorm';
import { slugify } from '../common/slug.js';
import { ProductImage } from './product-image.entity.js';
import { ProductVariant } from './product-variant.entity.js';
import { Product } from './product.entity.js';
import type { ProductFormInput, VariantInput } from './product-form-parser.js';

const PER_PAGE = 10;

export interface ProductListQuery {
  page?: number;
  search?: string;
  categoryId?: number;
  brandId?: number;
  status?: boolean;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly images: Repository<ProductImage>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: ProductListQuery) {
    const page = query.page ?? 1;

    const qb = this.products
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.brand', 'brand')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.variants', 'variants')
      .orderBy('product.createdAt', 'DESC')
      .skip((page - 1) * PER_PAGE)
      .take(PER_PAGE);

    if (query.search) {
      qb.andWhere('(product.name LIKE :search OR product.sku LIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId: query.categoryId });
    }
    if (query.brandId) {
      qb.andWhere('product.brandId = :brandId', { brandId: query.brandId });
    }
    if (query.status !== undefined) {
      qb.andWhere('product.status = :status', { status: query.status });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { page, perPage: PER_PAGE, total, lastPage: Math.max(1, Math.ceil(total / PER_PAGE)) },
    };
  }

  async findOne(id: number) {
    const product = await this.products.findOne({
      where: { id },
      relations: {
        category: true,
        brand: true,
        images: true,
        variants: { color: true, size: true },
      },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  async create(input: ProductFormInput, files: Express.Multer.File[], variantImages: Express.Multer.File[]) {
    return this.dataSource.transaction(async (manager) => {
      const product = manager.create(Product, {
        categoryId: input.categoryId,
        brandId: input.brandId,
        name: input.name,
        slug: slugify(input.name),
        sku: await this.generateSku(manager.getRepository(Product)),
        sourceReference: input.sourceReference,
        price: String(input.price),
        discountPrice: input.discountPrice !== null ? String(input.discountPrice) : null,
        stock: input.stock,
        description: input.description,
        status: input.status,
        createdAt: new Date(),
      });

      await manager.save(product);
      await this.attachImages(manager.getRepository(ProductImage), product.id, files, 0);
      await this.syncVariants(
        manager.getRepository(ProductVariant),
        manager.getRepository(ProductImage),
        product.id,
        input.variants,
        variantImages,
      );

      return product.id;
    }).then((id) => this.findOne(id));
  }

  async update(
    id: number,
    input: ProductFormInput,
    files: Express.Multer.File[],
    variantImages: Express.Multer.File[],
  ) {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found.');

    return this.dataSource.transaction(async (manager) => {
      product.categoryId = input.categoryId;
      product.brandId = input.brandId;
      product.name = input.name;
      product.slug = slugify(input.name);
      product.sourceReference = input.sourceReference;
      product.price = String(input.price);
      product.discountPrice = input.discountPrice !== null ? String(input.discountPrice) : null;
      product.stock = input.stock;
      product.description = input.description;
      product.status = input.status;

      await manager.save(product);

      const existingCount = await manager.count(ProductImage, { where: { productId: id } });
      await this.attachImages(manager.getRepository(ProductImage), id, files, existingCount);
      await this.syncVariants(
        manager.getRepository(ProductVariant),
        manager.getRepository(ProductImage),
        id,
        input.variants,
        variantImages,
      );

      return id;
    }).then((productId) => this.findOne(productId));
  }

  async remove(id: number) {
    const product = await this.products.findOne({ where: { id }, relations: { images: true } });
    if (!product) throw new NotFoundException('Product not found.');

    await Promise.all(product.images.map((image) => this.deleteImageFile(image.image)));
    await this.products.remove(product);
  }

  async bulkAction(ids: number[], action: 'delete' | 'active' | 'inactive') {
    if (action === 'delete') {
      const targets = await this.products.find({ where: { id: In(ids) }, relations: { images: true } });
      await Promise.all(targets.flatMap((p) => p.images.map((img) => this.deleteImageFile(img.image))));
      await this.products.remove(targets);
      return;
    }

    await this.products
      .createQueryBuilder()
      .update(Product)
      .set({ status: action === 'active' })
      .whereInIds(ids)
      .execute();
  }

  async removeImage(imageId: number) {
    const image = await this.images.findOne({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found.');

    const stillUsedByVariant = await this.variants.exists({
      where: { productId: image.productId, image: image.image },
    });
    if (!stillUsedByVariant) {
      await this.deleteImageFile(image.image);
    }
    await this.images.remove(image);

    const hasPrimary = await this.images.exists({
      where: { productId: image.productId, isPrimary: true },
    });

    if (!hasPrimary) {
      const first = await this.images.findOne({
        where: { productId: image.productId },
        order: { sortOrder: 'ASC' },
      });
      if (first) {
        await this.images.update(first.id, { isPrimary: true });
      }
    }
  }

  async setPrimaryImage(imageId: number) {
    const image = await this.images.findOne({ where: { id: imageId } });
    if (!image) throw new NotFoundException('Image not found.');

    await this.dataSource.transaction(async (manager) => {
      await manager.update(ProductImage, { productId: image.productId }, { isPrimary: false });
      await manager.update(ProductImage, { id: imageId }, { isPrimary: true });
    });
  }

  async reorderImages(imageIds: number[]) {
    const images = await this.images.findBy({ id: In(imageIds) });
    const productIds = new Set(images.map((i) => i.productId));

    if (productIds.size > 1) {
      throw new BadRequestException('Images must belong to the same product.');
    }

    await this.dataSource.transaction(async (manager) => {
      await Promise.all(
        imageIds.map((id, index) => manager.update(ProductImage, { id }, { sortOrder: index })),
      );
    });
  }

  private async attachImages(
    repo: Repository<ProductImage>,
    productId: number,
    files: Express.Multer.File[],
    startIndex: number,
  ) {
    if (!files.length) return;

    const hasPrimaryAlready = startIndex > 0 && (await repo.exists({ where: { productId, isPrimary: true } }));

    const rows = files.map((file, index) =>
      repo.create({
        productId,
        image: `products/${file.filename}`,
        isPrimary: !hasPrimaryAlready && startIndex + index === 0,
        sortOrder: startIndex + index,
      }),
    );

    await repo.save(rows);
  }

  private async syncVariants(
    repo: Repository<ProductVariant>,
    imagesRepo: Repository<ProductImage>,
    productId: number,
    rows: VariantInput[],
    variantImages: Express.Multer.File[],
  ) {
    const keepIds: number[] = [];

    for (const row of rows) {
      if (!row.colorId && !row.sizeId) continue;

      const existing = row.id ? await repo.findOne({ where: { id: row.id, productId } }) : null;

      const data: Partial<ProductVariant> & { productId: number } = {
        productId,
        colorId: row.colorId,
        sizeId: row.sizeId,
        sku: row.sku,
        price: row.price !== null ? String(row.price) : null,
        discountPrice: row.discountPrice !== null ? String(row.discountPrice) : null,
        stock: row.stock,
        status: true,
      };

      const newFile = row.imageIndex !== null ? variantImages[row.imageIndex] : undefined;

      if (newFile) {
        // A freshly uploaded file - safe to release the old one, it's exclusive to this row.
        if (existing?.image) {
          await this.releaseVariantImageFile(existing.image, productId, existing.id, imagesRepo, repo);
        }
        data.image = `products/${newFile.filename}`;
      } else if (row.reuseImagePath) {
        // Pointing at an already-uploaded product image - no new file, and only release the
        // previous one if it's actually being swapped out (not just re-selecting the same one).
        if (existing?.image && existing.image !== row.reuseImagePath) {
          await this.releaseVariantImageFile(existing.image, productId, existing.id, imagesRepo, repo);
        }
        data.image = row.reuseImagePath;
      } else if (row.removeImage) {
        if (existing?.image) {
          await this.releaseVariantImageFile(existing.image, productId, existing.id, imagesRepo, repo);
        }
        data.image = null;
      }

      if (existing) {
        await repo.update(existing.id, data);
        keepIds.push(existing.id);
      } else {
        const created = await repo.save(repo.create(data));
        keepIds.push(created.id);
      }
    }

    const removedQb = repo
      .createQueryBuilder()
      .where('product_id = :productId', { productId });
    if (keepIds.length) {
      removedQb.andWhere('id NOT IN (:...keepIds)', { keepIds });
    }
    const removed = await removedQb.getMany();
    await Promise.all(
      removed
        .filter((v) => v.image)
        .map((v) => this.releaseVariantImageFile(v.image as string, productId, v.id, imagesRepo, repo)),
    );

    const qb = repo.createQueryBuilder().delete().where('product_id = :productId', { productId });
    if (keepIds.length) {
      qb.andWhere('id NOT IN (:...keepIds)', { keepIds });
    }
    await qb.execute();
  }

  /**
   * Variant images can point at a file that's also the product's own gallery image, or shared
   * with another variant (picked via "choose existing image" instead of a fresh upload). Only
   * physically delete the file once nothing else references that same path.
   */
  private async releaseVariantImageFile(
    path: string,
    productId: number,
    excludeVariantId: number,
    imagesRepo: Repository<ProductImage>,
    variantsRepo: Repository<ProductVariant>,
  ) {
    const usedByGallery = await imagesRepo.exists({ where: { productId, image: path } });
    if (usedByGallery) return;

    const usedByOtherVariant = await variantsRepo.exists({
      where: { productId, image: path, id: Not(excludeVariantId) },
    });
    if (usedByOtherVariant) return;

    await this.deleteImageFile(path);
  }

  private async generateSku(repo: Repository<Product>): Promise<string> {
    const raw = await repo.manager.query(
      "SELECT MAX(CAST(SUBSTRING(sku, 10) AS UNSIGNED)) as max_number FROM products WHERE sku LIKE 'BAR-PROD-%'",
    );
    let lastNumber = Number(raw?.[0]?.max_number ?? 0);

    let sku: string;
    do {
      lastNumber += 1;
      sku = `BAR-PROD-${String(lastNumber).padStart(5, '0')}`;
    } while (await repo.exists({ where: { sku } }));

    return sku;
  }

  private async deleteImageFile(relativePath: string) {
    const root = (process.env.LARAVEL_PUBLIC_STORAGE_PATH ?? '').replace(/[/\\]products[/\\]?$/, '');
    if (!root) return;
    try {
      await unlink(join(root, relativePath));
    } catch {
      // file already missing - nothing to clean up
    }
  }
}
