import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Size } from './size.entity.js';
import type { SizeDto } from './dto/size.dto.js';

const PER_PAGE = 10;

@Injectable()
export class SizesService {
  constructor(
    @InjectRepository(Size)
    private readonly sizes: Repository<Size>,
  ) {}

  async findAll(page = 1) {
    const [data, total] = await this.sizes.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    });
    return {
      data,
      meta: { page, perPage: PER_PAGE, total, lastPage: Math.max(1, Math.ceil(total / PER_PAGE)) },
    };
  }

  findActive() {
    return this.sizes.find({ where: { status: true }, order: { name: 'ASC' } });
  }

  async findOne(id: number) {
    const size = await this.sizes.findOne({ where: { id } });
    if (!size) throw new NotFoundException('Size not found.');
    return size;
  }

  create(dto: SizeDto) {
    return this.sizes.save(
      this.sizes.create({ name: dto.name, status: dto.status, createdAt: new Date() }),
    );
  }

  async update(id: number, dto: SizeDto) {
    const size = await this.findOne(id);
    size.name = dto.name;
    size.status = dto.status;
    return this.sizes.save(size);
  }

  async remove(id: number) {
    const size = await this.findOne(id);
    await this.sizes.remove(size);
  }
}
