import { Controller, Get, Header } from '@nestjs/common';
import { FeedsService } from './feeds.service.js';

/**
 * SitemapController and ProductFeedController. Nginx serves these on the
 * storefront domain (barakahly.com/sitemap.xml, /product-feed.xml), so
 * search engines and the Facebook catalog keep their existing URLs.
 */
@Controller()
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'text/xml; charset=UTF-8')
  sitemap() {
    return this.feeds.sitemap();
  }

  @Get('product-feed.xml')
  @Header('Content-Type', 'application/xml; charset=UTF-8')
  productFeed() {
    return this.feeds.productFeed();
  }
}
