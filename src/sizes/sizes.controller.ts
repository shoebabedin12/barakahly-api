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
import { SizeDto } from './dto/size.dto.js';
import { SizesService } from './sizes.service.js';

@Controller('api/v1/admin/sizes')
@UseGuards(AdminJwtGuard)
export class SizesController {
  constructor(private readonly sizesService: SizesService) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.sizesService.findAll(page ? parseInt(page, 10) : 1);
  }

  @Get('active')
  findActive() {
    return this.sizesService.findActive();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sizesService.findOne(id);
  }

  @Post()
  create(@Body() dto: SizeDto) {
    return this.sizesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: SizeDto) {
    return this.sizesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.sizesService.remove(id);
    return { message: 'Size deleted successfully.' };
  }
}
