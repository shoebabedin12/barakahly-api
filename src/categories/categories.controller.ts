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
import { CategoriesService } from './categories.service.js';
import { CategoryDto } from './dto/category.dto.js';

@Controller('api/v1/admin/categories')
@UseGuards(AdminJwtGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.categoriesService.findAll(page ? parseInt(page, 10) : 1);
  }

  @Get('top-level')
  topLevel(@Query('exclude') exclude?: string) {
    return this.categoriesService.topLevel(exclude ? parseInt(exclude, 10) : undefined);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.categoriesService.remove(id);
    return { message: 'Category deleted successfully.' };
  }
}
