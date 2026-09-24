import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { slugify } from '../common/slug.js';
import { Category } from './category.entity.js';
import type { CategoryDto } from './dto/category.dto.js';

const PER_PAGE = 20;

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  /** Same ordering as Admin\CategoryController@index: groups each
   * top-level category together with its children, alphabetically.
   * Sorted in memory rather than via a raw SQL ORDER BY - TypeORM's query
   * builder parses orderBy() strings as alias.column references and
   * chokes on a COALESCE(...) expression. Category counts are small
   * enough (tens, not thousands) that this is simpler and just as fast. */
  async findAll(page = 1) {
    const all = await this.categories.find({ relations: { parent: true } });

    all.sort((a, b) => {
      const groupA = a.parentId ?? a.id;
      const groupB = b.parentId ?? b.id;
      if (groupA !== groupB) return groupA - groupB;

      const parentA = a.parentId ?? -Infinity; // NULL sorts first, same as MySQL ASC
      const parentB = b.parentId ?? -Infinity;
      if (parentA !== parentB) return parentA - parentB;

      return a.name.localeCompare(b.name);
    });

    const total = all.length;
    const data = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return {
      data,
      meta: { page, perPage: PER_PAGE, total, lastPage: Math.max(1, Math.ceil(total / PER_PAGE)) },
    };
  }

  /** Top-level categories, for the "Parent category" dropdown. */
  async topLevel(excludeId?: number) {
    const qb = this.categories
      .createQueryBuilder('category')
      .where('category.parent_id IS NULL')
      .orderBy('category.name', 'ASC');

    if (excludeId) {
      qb.andWhere('category.id != :excludeId', { excludeId });
    }

    return qb.getMany();
  }

  async findOne(id: number) {
    const category = await this.categories.findOne({ where: { id }, relations: { parent: true } });
    if (!category) throw new NotFoundException('Category not found.');
    return category;
  }

  async create(dto: CategoryDto) {
    await this.assertValidParent(dto.parentId ?? null, null);

    const category = this.categories.create({
      name: dto.name,
      slug: slugify(dto.name),
      description: dto.description ?? null,
      status: dto.status,
      parentId: dto.parentId ?? null,
    });

    return this.save(category);
  }

  async update(id: number, dto: CategoryDto) {
    const category = await this.findOne(id);
    await this.assertValidParent(dto.parentId ?? null, id);

    category.name = dto.name;
    category.slug = slugify(dto.name);
    category.description = dto.description ?? null;
    category.status = dto.status;
    category.parentId = dto.parentId ?? null;

    return this.save(category);
  }

  async remove(id: number) {
    const category = await this.findOne(id);
    // NB: `products.category_id` cascades on delete at the DB level - this
    // removes every product in the category too, same as the Laravel admin.
    await this.categories.remove(category);
  }

  /** Mirrors CategoryRequest's parent_id rule: must be an existing
   * top-level category, and a category can't be its own parent. */
  private async assertValidParent(parentId: number | null, selfId: number | null) {
    if (parentId === null) return;

    if (parentId === selfId) {
      throw new BadRequestException('A category cannot be its own parent.');
    }

    const parent = await this.categories.findOne({ where: { id: parentId } });
    if (!parent || parent.parentId !== null) {
      throw new BadRequestException('Parent category must be an existing top-level category.');
    }
  }

  private async save(category: Category) {
    try {
      return await this.categories.save(category);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('A category with a matching slug already exists.');
      }
      throw err;
    }
  }
}
