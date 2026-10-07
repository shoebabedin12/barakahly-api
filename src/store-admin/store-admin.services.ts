import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Banner } from '../banners/banner.entity.js';
import { assetUrl } from '../common/asset-url.js';
import { LaravelValidationException } from '../common/laravel-validation.js';
import { deletePublicFile, storedPath } from '../common/public-storage.js';
import { Coupon } from '../coupons/coupon.entity.js';
import { PaymentMethod } from '../payment-methods/payment-method.entity.js';
import { Review } from '../reviews/review.entity.js';
import { Setting } from '../settings/setting.entity.js';
import { ShippingZone } from '../shipping-zones/shipping-zone.entity.js';
import { adminPage, money, orNotFound } from './admin-page.js';
import type {
  CouponAdminDto,
  PaymentMethodAdminDto,
  ShippingZoneAdminDto,
} from './dto/store-admin.dto.js';

/** Admin\CouponController. */
@Injectable()
export class CouponsAdminService {
  constructor(
    @InjectRepository(Coupon) private readonly coupons: Repository<Coupon>,
  ) {}

  async findAll(page: number) {
    const perPage = 15;
    const [rows, total] = await this.coupons.findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return adminPage(rows, total, page, perPage);
  }

  async findOne(id: number) {
    return orNotFound(await this.coupons.findOneBy({ id }), 'Coupon');
  }

  private async save(dto: CouponAdminDto, existing?: Coupon) {
    const code = dto.code.trim().toUpperCase();
    if (
      await this.coupons.existsBy({
        code,
        ...(existing ? { id: Not(existing.id) } : {}),
      })
    ) {
      throw LaravelValidationException.field(
        'code',
        'The code has already been taken.',
      );
    }
    if (dto.startDate && dto.endDate && dto.endDate < dto.startDate) {
      throw LaravelValidationException.field(
        'endDate',
        'The end date must be on or after the start date.',
      );
    }
    if (dto.type === 'percentage' && dto.value > 100) {
      throw LaravelValidationException.field(
        'value',
        'A percentage discount cannot be more than 100.',
      );
    }
    return this.coupons.save(
      Object.assign(existing ?? this.coupons.create(), {
        code,
        type: dto.type,
        value: dto.value.toFixed(2),
        minOrderAmount: (dto.minOrderAmount ?? 0).toFixed(2),
        maxDiscount: money(dto.maxDiscount),
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        usageLimit: dto.usageLimit ?? null,
        status: dto.status,
      }),
    );
  }

  create(dto: CouponAdminDto) {
    return this.save(dto);
  }

  async update(id: number, dto: CouponAdminDto) {
    return this.save(dto, await this.findOne(id));
  }

  async remove(id: number) {
    await this.coupons.delete((await this.findOne(id)).id);
  }
}

/** Admin\PaymentMethodController. */
@Injectable()
export class PaymentMethodsAdminService {
  constructor(
    @InjectRepository(PaymentMethod)
    private readonly methods: Repository<PaymentMethod>,
  ) {}

  async findAll() {
    const rows = await this.methods.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return adminPage(rows, rows.length, 1, Math.max(rows.length, 1));
  }

  async findOne(id: number) {
    return orNotFound(await this.methods.findOneBy({ id }), 'Payment method');
  }

  private async save(dto: PaymentMethodAdminDto, existing?: PaymentMethod) {
    if (
      await this.methods.existsBy({
        code: dto.code,
        ...(existing ? { id: Not(existing.id) } : {}),
      })
    ) {
      throw LaravelValidationException.field(
        'code',
        'The code has already been taken.',
      );
    }
    return this.methods.save(
      Object.assign(existing ?? this.methods.create(), {
        name: dto.name,
        code: dto.code,
        instructions: dto.instructions ?? null,
        receivingNumber: dto.receivingNumber ?? null,
        sortOrder: dto.sortOrder ?? 0,
        requiresTransactionId: dto.requiresTransactionId,
        status: dto.status,
      }),
    );
  }

  create(dto: PaymentMethodAdminDto) {
    return this.save(dto);
  }

  async update(id: number, dto: PaymentMethodAdminDto) {
    return this.save(dto, await this.findOne(id));
  }

  async remove(id: number) {
    await this.methods.delete((await this.findOne(id)).id);
  }
}

/** Admin\ShippingZoneController. */
@Injectable()
export class ShippingZonesAdminService {
  constructor(
    @InjectRepository(ShippingZone)
    private readonly zones: Repository<ShippingZone>,
  ) {}

  async findAll() {
    const rows = await this.zones.find({
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return adminPage(rows, rows.length, 1, Math.max(rows.length, 1));
  }

  async findOne(id: number) {
    return orNotFound(await this.zones.findOneBy({ id }), 'Shipping zone');
  }

  private save(dto: ShippingZoneAdminDto, existing?: ShippingZone) {
    return this.zones.save(
      Object.assign(existing ?? this.zones.create(), {
        name: dto.name,
        charge: dto.charge.toFixed(2),
        status: dto.status,
      }),
    );
  }

  create(dto: ShippingZoneAdminDto) {
    return this.save(dto);
  }

  async update(id: number, dto: ShippingZoneAdminDto) {
    return this.save(dto, await this.findOne(id));
  }

  async remove(id: number) {
    await this.zones.delete((await this.findOne(id)).id);
  }
}

export interface BannerForm {
  title: string;
  subtitle: string | null;
  position: 'hero' | 'promo';
  buttonText: string | null;
  buttonLink: string | null;
  sortOrder: number;
  status: boolean;
}

/** Multipart bodies arrive as strings; validate and coerce the banner fields. */
export function parseBannerForm(
  body: Record<string, string | undefined>,
): BannerForm {
  const errors: Record<string, string[]> = {};
  const text = (value: string | undefined) =>
    value && value.trim() ? value.trim() : null;

  const title = text(body.title);
  if (!title) errors.title = ['The title field is required.'];
  else if (title.length > 255)
    errors.title = ['The title field must not be greater than 255 characters.'];

  const position = body.position ?? 'hero';
  if (position !== 'hero' && position !== 'promo')
    errors.position = ['The selected position is invalid.'];

  const sortOrder = body.sortOrder ? Number(body.sortOrder) : 0;
  if (!Number.isInteger(sortOrder))
    errors.sortOrder = ['The sort order field must be an integer.'];

  if (Object.keys(errors).length) throw new LaravelValidationException(errors);

  return {
    title: title as string,
    subtitle: text(body.subtitle),
    position: position as 'hero' | 'promo',
    buttonText: text(body.buttonText),
    buttonLink: text(body.buttonLink),
    sortOrder,
    status: body.status !== 'false' && body.status !== '0',
  };
}

/** Admin\BannerController (images live under storage/app/public/banners). */
@Injectable()
export class BannersAdminService {
  constructor(
    @InjectRepository(Banner) private readonly banners: Repository<Banner>,
  ) {}

  private present(banner: Banner) {
    return { ...banner, imageUrl: assetUrl(banner.image) };
  }

  async findAll() {
    const rows = await this.banners.find({
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return adminPage(
      rows.map((b) => this.present(b)),
      rows.length,
      1,
      Math.max(rows.length, 1),
    );
  }

  async findOne(id: number) {
    return this.present(
      orNotFound(await this.banners.findOneBy({ id }), 'Banner'),
    );
  }

  async create(form: BannerForm, image: Express.Multer.File | undefined) {
    if (!image)
      throw LaravelValidationException.field(
        'image',
        'The image field is required.',
      );
    const banner = await this.banners.save(
      this.banners.create({ ...form, image: storedPath('banners', image) }),
    );
    return this.present(banner);
  }

  async update(
    id: number,
    form: BannerForm,
    image: Express.Multer.File | undefined,
  ) {
    const banner = orNotFound(await this.banners.findOneBy({ id }), 'Banner');
    const oldImage = banner.image;
    Object.assign(banner, form);
    if (image) banner.image = storedPath('banners', image);
    const saved = await this.banners.save(banner);
    if (image) await deletePublicFile(oldImage);
    return this.present(saved);
  }

  async remove(id: number) {
    const banner = orNotFound(await this.banners.findOneBy({ id }), 'Banner');
    await this.banners.delete(banner.id);
    await deletePublicFile(banner.image);
  }
}

/** Admin\ReviewController - moderation. */
@Injectable()
export class ReviewsAdminService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
  ) {}

  async findAll(page: number, rating?: string, status?: string) {
    const perPage = 15;
    const qb = this.reviews
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.product', 'product')
      .leftJoinAndSelect('r.customer', 'customer')
      .orderBy('r.createdAt', 'DESC')
      .addOrderBy('r.id', 'DESC');
    if (rating && /^[1-5]$/.test(rating))
      qb.andWhere('r.rating = :rating', { rating: Number(rating) });
    if (status === 'approved' || status === 'hidden')
      qb.andWhere('r.status = :status', { status: status === 'approved' });

    const [rows, total] = await qb
      .skip((page - 1) * perPage)
      .take(perPage)
      .getManyAndCount();
    return adminPage(
      rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        createdAt: r.createdAt,
        product: r.product
          ? { id: r.product.id, name: r.product.name, slug: r.product.slug }
          : null,
        customer: r.customer
          ? {
              id: r.customer.id,
              name: r.customer.name,
              phone: r.customer.phone,
            }
          : null,
      })),
      total,
      page,
      perPage,
    );
  }

  async toggle(id: number) {
    const review = orNotFound(await this.reviews.findOneBy({ id }), 'Review');
    review.status = !review.status;
    await this.reviews.save(review);
    return { id: review.id, status: review.status };
  }

  async remove(id: number) {
    await this.reviews.delete(
      orNotFound(await this.reviews.findOneBy({ id }), 'Review').id,
    );
  }
}

const SETTING_TEXT_FIELDS = {
  siteName: 255,
  contactEmail: 255,
  contactPhone: 20,
  address: 2000,
  currency: 10,
  facebook: 255,
  facebookPixelId: 50,
  clarityProjectId: 50,
  gtmId: 50,
  instagram: 255,
  youtube: 255,
  whatsapp: 20,
  metaTitle: 255,
  metaDescription: 500,
  mailHost: 255,
  mailPort: 10,
  mailUsername: 255,
  mailFromAddress: 255,
  mailFromName: 255,
} as const;

type SettingTextField = keyof typeof SETTING_TEXT_FIELDS;

/** Admin\SettingController - the single settings row, logo and favicon included. */
@Injectable()
export class SettingsAdminService {
  constructor(
    @InjectRepository(Setting) private readonly settings: Repository<Setting>,
  ) {}

  private async current() {
    const setting = await this.settings.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!setting) throw new BadRequestException('The settings row is missing.');
    return setting;
  }

  async get() {
    const { mailPassword, ...setting } = await this.current();
    return {
      ...setting,
      hasMailPassword: Boolean(mailPassword),
      logoUrl: assetUrl(setting.siteLogo),
      faviconUrl: assetUrl(setting.siteFavicon),
    };
  }

  async update(
    body: Record<string, string | undefined>,
    files: { logo?: Express.Multer.File[]; favicon?: Express.Multer.File[] },
  ) {
    const errors: Record<string, string[]> = {};
    const values: Partial<Record<SettingTextField, string | null>> = {};
    for (const [field, max] of Object.entries(SETTING_TEXT_FIELDS) as [
      SettingTextField,
      number,
    ][]) {
      const raw = body[field];
      const value = raw && raw.trim() ? raw.trim() : null;
      if (value && value.length > max)
        errors[field] = [
          `This field must not be greater than ${max} characters.`,
        ];
      values[field] = value;
    }
    if (!values.siteName)
      errors.siteName = ['The site name field is required.'];
    if (!values.currency) errors.currency = ['The currency field is required.'];
    const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const field of ['contactEmail', 'mailFromAddress'] as const) {
      if (values[field] && !emailLike.test(values[field] as string))
        errors[field] = ['Please enter a valid email address.'];
    }
    for (const field of ['facebook', 'instagram', 'youtube'] as const) {
      if (values[field] && !/^https?:\/\//i.test(values[field] as string))
        errors[field] = ['Please enter a full URL (https://...).'];
    }
    const shippingCharge = Number(body.shippingCharge);
    if (
      body.shippingCharge === undefined ||
      body.shippingCharge === '' ||
      !Number.isFinite(shippingCharge)
    ) {
      errors.shippingCharge = ['The shipping charge field must be a number.'];
    }
    const encryption = body.mailEncryption || null;
    if (encryption && encryption !== 'tls' && encryption !== 'ssl')
      errors.mailEncryption = ['The selected mail encryption is invalid.'];
    const flashDeal = body.flashDealEndsAt
      ? new Date(body.flashDealEndsAt)
      : null;
    if (flashDeal && Number.isNaN(flashDeal.getTime()))
      errors.flashDealEndsAt = ['Please enter a valid date.'];
    if (Object.keys(errors).length)
      throw new LaravelValidationException(errors);

    const setting = await this.current();
    const oldLogo = setting.siteLogo;
    const oldFavicon = setting.siteFavicon;
    const logo = files.logo?.[0];
    const favicon = files.favicon?.[0];

    Object.assign(setting, values, {
      siteName: values.siteName as string,
      currency: values.currency as string,
      shippingCharge: shippingCharge.toFixed(2),
      mailEncryption: encryption,
      flashDealEndsAt: flashDeal,
      maintenanceMode:
        body.maintenanceMode === 'true' || body.maintenanceMode === '1',
      // Blank means "keep the saved password", same as the Laravel form.
      ...(body.mailPassword ? { mailPassword: body.mailPassword } : {}),
      ...(logo ? { siteLogo: storedPath('branding', logo) } : {}),
      ...(favicon ? { siteFavicon: storedPath('branding', favicon) } : {}),
    });
    await this.settings.save(setting);

    if (logo) await deletePublicFile(oldLogo);
    if (favicon) await deletePublicFile(oldFavicon);
    return this.get();
  }
}
