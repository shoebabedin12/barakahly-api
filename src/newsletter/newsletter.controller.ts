import { Body, Controller, Post } from '@nestjs/common';
import { SubscribeDto } from './dto/subscribe.dto.js';
import { NewsletterService } from './newsletter.service.js';

/** Mirrors Api\V1\NewsletterController@store (POST /api/v1/newsletter/subscribe). */
@Controller('api/v1/newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletterService.subscribe(dto.email);
  }
}
