import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { slugify } from '../common/slug.js';
import { Brand } from './brand.entity.js';
import type { BrandDto } from './dto/brand.dto.js';

const PER_PAGE = 10;

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(Brand)
    private readonly brands: Repository<Brand>,
  ) {}

  async findAll(page = 1) {
    const [data, total] = await this.brands.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    });

    return {
      data,
      meta: { page, perPage: PER_PAGE, total, lastPage: Math.max(1, Math.ceil(total / PER_PAGE)) },
    };
  }

  async findOne(id: number) {
    const brand = await this.brands.findOne({ where: { id } });
    if (!brand) throw new NotFoundException('Brand not found.');
    return brand;
  }

  create(dto: BrandDto) {
    const brand = this.brands.create({
      name: dto.name,
      slug: slugify(dto.name),
      description: dto.description ?? null,
      status: dto.status,
      // @CreateDateColumn's auto-populate-on-insert isn't firing with this
      // TypeORM setup, so set it explicitly rather than chase why.
      createdAt: new Date(),
    });
    return this.save(brand);
  }

  async update(id: number, dto: BrandDto) {
    const brand = await this.findOne(id);
    brand.name = dto.name;
    brand.slug = slugify(dto.name);
    brand.description = dto.description ?? null;
    brand.status = dto.status;
    return this.save(brand);
  }

  async remove(id: number) {
    const brand = await this.findOne(id);
    await this.brands.remove(brand);
  }

  private async save(brand: Brand) {
    try {
      return await this.brands.save(brand);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('A brand with a matching slug already exists.');
      }
      throw err;
    }
  }
}
