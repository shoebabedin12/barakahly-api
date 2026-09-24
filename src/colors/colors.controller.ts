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
import { colorImageMulterOptions } from './color-image-storage.js';
import { parseColorForm } from './color-form-parser.js';
import { ColorsService } from './colors.service.js';

@Controller('api/v1/admin/colors')
@UseGuards(AdminJwtGuard)
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.colorsService.findAll(page ? parseInt(page, 10) : 1);
  }

  @Get('active')
  findActive() {
    return this.colorsService.findActive();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.colorsService.findOne(id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', colorImageMulterOptions()))
  create(@Body() body: Record<string, string>, @UploadedFile() image?: Express.Multer.File) {
    return this.colorsService.create(parseColorForm(body), image ?? null);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', colorImageMulterOptions()))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, string>,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.colorsService.update(id, parseColorForm(body), image ?? null);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.colorsService.remove(id);
    return { message: 'Color deleted successfully.' };
  }
}
