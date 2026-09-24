import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assetUrl } from '../common/asset-url.js';
import { Setting } from './setting.entity.js';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settings: Repository<Setting>,
  ) {}

  /**
   * Mirrors Api\V1\SettingController@index / PublicSettingResource exactly:
   * an explicit field whitelist, never the full row (which holds SMTP
   * credentials).
   */
  async getPublicSettings() {
    const setting = await this.settings.findOne({ where: {}, order: { id: 'ASC' as const } });

    return {
      site_name: setting?.siteName ?? null,
      site_logo: assetUrl(setting?.siteLogo ?? null),
      site_favicon: assetUrl(setting?.siteFavicon ?? null),
      contact_email: setting?.contactEmail ?? null,
      contact_phone: setting?.contactPhone ?? null,
      address: setting?.address ?? null,
      shipping_charge: setting ? Number(setting.shippingCharge) : null,
      currency: setting?.currency ?? null,
      facebook: setting?.facebook ?? null,
      instagram: setting?.instagram ?? null,
      youtube: setting?.youtube ?? null,
      whatsapp: setting?.whatsapp ?? null,
      meta_title: setting?.metaTitle ?? null,
      meta_description: setting?.metaDescription ?? null,
      flash_deal_ends_at: setting?.flashDealEndsAt?.toISOString() ?? null,
      maintenance_mode: Boolean(setting?.maintenanceMode),
    };
  }
}
