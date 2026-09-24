import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { BrandsService } from './brands.service.js';
import { BrandDto } from './dto/brand.dto.js';

@Controller('api/v1/admin/brands')
@UseGuards(AdminJwtGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.brandsService.findAll(page ? parseInt(page, 10) : 1);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.brandsService.findOne(id);
  }

  @Post()
  create(@Body() dto: BrandDto) {
    return this.brandsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: BrandDto) {
    return this.brandsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.brandsService.remove(id);
    return { message: 'Brand deleted successfully.' };
  }
}
