import { Body, Controller, Post } from '@nestjs/common';
import { ContactDto } from './dto/contact.dto.js';
import { PagesService } from './pages.service.js';

/** Mirrors Api\V1\PageController@sendContact (POST /api/v1/contact). */
@Controller('api/v1')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post('contact')
  sendContact(@Body() dto: ContactDto) {
    return this.pagesService.sendContact(dto);
  }
}
