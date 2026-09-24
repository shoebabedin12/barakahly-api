import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Color } from './color.entity.js';
import type { ColorFormInput } from './color-form-parser.js';

const PER_PAGE = 10;

@Injectable()
export class ColorsService {
  constructor(
    @InjectRepository(Color)
    private readonly colors: Repository<Color>,
  ) {}

  async findAll(page = 1) {
    const [data, total] = await this.colors.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    });
    return {
      data,
      meta: { page, perPage: PER_PAGE, total, lastPage: Math.max(1, Math.ceil(total / PER_PAGE)) },
    };
  }

  /** All active colors, unpaginated - for the product variant form. */
  findActive() {
    return this.colors.find({ where: { status: true }, order: { name: 'ASC' } });
  }

  async findOne(id: number) {
    const color = await this.colors.findOne({ where: { id } });
    if (!color) throw new NotFoundException('Color not found.');
    return color;
  }

  create(dto: ColorFormInput, image: Express.Multer.File | null) {
    return this.colors.save(
      this.colors.create({
        name: dto.name,
        hexCode: dto.hexCode,
        image: image ? `colors/${image.filename}` : null,
        status: dto.status,
        createdAt: new Date(),
      }),
    );
  }

  async update(id: number, dto: ColorFormInput, image: Express.Multer.File | null) {
    const color = await this.findOne(id);
    color.name = dto.name;
    color.hexCode = dto.hexCode;
    color.status = dto.status;

    if (image) {
      if (color.image) await this.deleteImageFile(color.image);
      color.image = `colors/${image.filename}`;
    } else if (dto.removeImage && color.image) {
      await this.deleteImageFile(color.image);
      color.image = null;
    }

    return this.colors.save(color);
  }

  async remove(id: number) {
    const color = await this.findOne(id);
    if (color.image) await this.deleteImageFile(color.image);
    await this.colors.remove(color);
  }

  private async deleteImageFile(relativePath: string) {
    const root = (process.env.LARAVEL_COLOR_STORAGE_PATH ?? '').replace(/[/\\]colors[/\\]?$/, '');
    if (!root) return;
    try {
      await unlink(join(root, relativePath));
    } catch {
      // file already missing - nothing to clean up
    }
  }
}
