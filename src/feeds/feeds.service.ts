import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductPresenterService } from '../catalog/product-presenter.service.js';
import { Product } from '../products/product.entity.js';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** strip_tags + decode the few entities rich-text descriptions contain. */
const plainText = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** Carbon::toAtomString() for a UTC timestamp. */
const atom = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, '+00:00');

@Injectable()
export class FeedsService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    private readonly presenter: ProductPresenterService,
  ) {}

  private get baseUrl() {
    return (process.env.STOREFRONT_URL ?? 'https://barakahly.com').replace(
      /\/+$/,
      '',
    );
  }

  async sitemap() {
    const base = this.baseUrl;
    const products = await this.products.find({
      where: { status: true },
      order: { id: 'ASC' },
    });
    const urls = [
      { loc: `${base}/`, priority: '1.0' },
      { loc: `${base}/products`, priority: '0.9' },
      { loc: `${base}/privacy-policy`, priority: '0.3' },
      { loc: `${base}/terms-and-conditions`, priority: '0.3' },
      { loc: `${base}/refund-policy`, priority: '0.3' },
      ...products.map((p) => ({
        loc: `${base}/products/${p.slug}`,
        lastmod: p.updatedAt ?? p.createdAt,
        priority: '0.7',
      })),
    ];

    const body = urls
      .map(
        (url) => `    <url>
        <loc>${escapeXml(url.loc)}</loc>
${'lastmod' in url && url.lastmod ? `        <lastmod>${atom(url.lastmod)}</lastmod>\n` : ''}        <priority>${url.priority}</priority>
    </url>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  }

  /** Facebook / Google catalog feed (RSS 2.0 with g: fields), keyed by SKU. */
  async productFeed() {
    const base = this.baseUrl;
    const products = await this.products.find({
      where: { status: true },
      relations: { brand: true, category: true },
      order: { id: 'ASC' },
    });
    const images = await this.presenter.imagesFor(products.map((p) => p.id));
    const money = (value: string) => `${Number(value).toFixed(2)} BDT`;

    const items = products
      .map((product) => {
        const image = ProductPresenterService.primaryImage(
          images.get(product.id) ?? [],
        );
        if (!image) return null;
        const description = plainText(
          product.description ?? product.name,
        ).slice(0, 5000);
        return `    <item>
        <g:id>${escapeXml(product.sku)}</g:id>
        <title>${escapeXml(product.name)}</title>
        <description>${escapeXml(description)}</description>
        <link>${escapeXml(`${base}/products/${product.slug}`)}</link>
        <g:image_link>${escapeXml(`${base}/storage/${image.image}`)}</g:image_link>
        <g:availability>${product.stock > 0 ? 'in stock' : 'out of stock'}</g:availability>
        <g:condition>new</g:condition>
        <g:price>${money(product.price)}</g:price>
${product.discountPrice ? `        <g:sale_price>${money(product.discountPrice)}</g:sale_price>\n` : ''}        <g:brand>${escapeXml(product.brand?.name || 'Barakahly')}</g:brand>
${product.category ? `        <g:product_type>${escapeXml(product.category.name)}</g:product_type>\n` : ''}    </item>`;
      })
      .filter(Boolean)
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
    <title>Barakahly Product Feed</title>
    <link>${base}</link>
    <description>Barakahly product catalog for Facebook/Instagram Shop and dynamic ads</description>
${items}
</channel>
</rss>
`;
  }
}
