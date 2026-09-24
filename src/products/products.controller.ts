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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { BulkActionDto } from './dto/bulk-action.dto.js';
import { ReorderImagesDto } from './dto/reorder-images.dto.js';
import { parseProductForm } from './product-form-parser.js';
import { productImageMulterOptions } from './product-image-storage.js';
import { ProductsService } from './products.service.js';

@Controller('api/v1/admin/products')
@UseGuards(AdminJwtGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('status') status?: string,
  ) {
    return this.productsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      search,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      brandId: brandId ? parseInt(brandId, 10) : undefined,
      status: status === 'true' ? true : status === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 10 },
        { name: 'variantImages', maxCount: 20 },
      ],
      productImageMulterOptions(),
    ),
  )
  create(
    @Body() body: Record<string, string>,
    @UploadedFiles() files: { images?: Express.Multer.File[]; variantImages?: Express.Multer.File[] } = {},
  ) {
    return this.productsService.create(parseProductForm(body), files.images ?? [], files.variantImages ?? []);
  }

  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'images', maxCount: 10 },
        { name: 'variantImages', maxCount: 20 },
      ],
      productImageMulterOptions(),
    ),
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, string>,
    @UploadedFiles() files: { images?: Express.Multer.File[]; variantImages?: Express.Multer.File[] } = {},
  ) {
    return this.productsService.update(
      id,
      parseProductForm(body),
      files.images ?? [],
      files.variantImages ?? [],
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.productsService.remove(id);
    return { message: 'Product deleted successfully.' };
  }

  @Post('bulk-action')
  async bulkAction(@Body() dto: BulkActionDto) {
    await this.productsService.bulkAction(dto.ids, dto.action);
    return { message: 'Bulk action completed successfully.' };
  }

  @Delete('images/:imageId')
  async removeImage(@Param('imageId', ParseIntPipe) imageId: number) {
    await this.productsService.removeImage(imageId);
    return { message: 'Image deleted successfully.' };
  }

  @Patch('images/:imageId/primary')
  async setPrimaryImage(@Param('imageId', ParseIntPipe) imageId: number) {
    await this.productsService.setPrimaryImage(imageId);
    return { message: 'Primary image updated.' };
  }

  @Post('images/reorder')
  async reorderImages(@Body() dto: ReorderImagesDto) {
    await this.productsService.reorderImages(dto.imageIds);
    return { message: 'Images reordered.' };
  }
}
