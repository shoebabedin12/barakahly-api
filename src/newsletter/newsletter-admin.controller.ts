import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { pageNumber } from '../store-admin/admin-page.js';
import { NewsletterMessageDto } from './dto/newsletter-admin.dto.js';
import { NewsletterAdminService } from './newsletter-admin.service.js';

@Controller('api/v1/admin/newsletter')
@UseGuards(AdminJwtGuard)
export class NewsletterAdminController {
  constructor(private readonly service: NewsletterAdminService) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.service.findAll(pageNumber(page));
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="newsletter-subscribers.csv"')
  export() {
    return this.service.exportCsv();
  }

  @Post('send')
  broadcast(@Body() dto: NewsletterMessageDto) {
    return this.service.broadcast(dto);
  }

  @Get('logs')
  logs(@Query('batches') batches?: string, @Query('individual') individual?: string) {
    return this.service.logsIndex(pageNumber(batches), pageNumber(individual));
  }

  @Get('logs/:batchId')
  batch(@Param('batchId', ParseUUIDPipe) batchId: string, @Query('page') page?: string) {
    return this.service.batch(batchId, pageNumber(page));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post(':id/send')
  sendOne(@Param('id', ParseIntPipe) id: number, @Body() dto: NewsletterMessageDto) {
    return this.service.sendOne(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Subscriber removed successfully.' };
  }
}
