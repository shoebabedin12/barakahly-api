import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { CategoryLandingsService } from './category-landings.service.js';
import { SaveLandingDto } from './dto/save-landing.dto.js';
import { landingImageMulterOptions } from './landing-image-storage.js';

@Controller('api/v1/admin/category-landings')
@UseGuards(AdminJwtGuard)
export class AdminCategoryLandingsController {
  constructor(private readonly landingsService: CategoryLandingsService) {}

  @Get()
  index() {
    return this.landingsService.adminIndex();
  }

  @Get(':categoryId')
  show(@Param('categoryId', ParseIntPipe) categoryId: number) {
    return this.landingsService.adminShow(categoryId);
  }

  @Put(':categoryId')
  save(@Param('categoryId', ParseIntPipe) categoryId: number, @Body() dto: SaveLandingDto) {
    return this.landingsService.adminSave(categoryId, dto.isActive, dto.content);
  }

  @Post('images')
  @UseInterceptors(FileInterceptor('image', landingImageMulterOptions()))
  upload(@UploadedFile() image?: Express.Multer.File) {
    if (!image) {
      throw new BadRequestException('Please choose an image to upload.');
    }
    return this.landingsService.uploadedImage(image);
  }
}

/** Public, read-only: what the storefront renders above a category's
 * product grid. 404 when the category has no active landing page. */
@Controller('api/v1/categories')
export class CategoryLandingsController {
  constructor(private readonly landingsService: CategoryLandingsService) {}

  @Get(':slug/landing')
  show(@Param('slug') slug: string) {
    return this.landingsService.publicShow(slug);
  }
}
