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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { positiveInt } from '../common/laravel-pagination.js';
import { publicImageUpload } from '../common/public-storage.js';
import { pageNumber } from '../store-admin/admin-page.js';
import { BlogService, parseBlogForm } from './blog.service.js';

const featuredImage = FileInterceptor('featuredImage', publicImageUpload('blog', 2048, ['.jpg', '.jpeg', '.png', '.webp', '.gif']));

@Controller('api/v1/admin/blog')
@UseGuards(AdminJwtGuard)
export class BlogAdminController {
  constructor(private readonly service: BlogService) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.service.findAll(pageNumber(page));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @UseInterceptors(featuredImage)
  create(@Body() body: Record<string, string>, @UploadedFile() image?: Express.Multer.File) {
    return this.service.create(parseBlogForm(body), image);
  }

  @Patch(':id')
  @UseInterceptors(featuredImage)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, string>,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.service.update(id, parseBlogForm(body), image);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Blog post deleted successfully.' };
  }
}

/** Api\V1\BlogController - the storefront's public blog. */
@Controller('api/v1/blog')
export class BlogController {
  constructor(private readonly service: BlogService) {}

  @Get()
  index(@Query('page') page?: string) {
    return this.service.publicIndex(positiveInt(page, 1));
  }

  @Get(':slug')
  show(@Param('slug') slug: string) {
    return this.service.publicShow(slug);
  }
}
