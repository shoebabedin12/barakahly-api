import { Controller, Get } from '@nestjs/common';
import { SettingsService } from './settings.service.js';

/** Mirrors Api\V1\SettingController@index (GET /api/v1/settings). */
@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    // PublicSettingResource on the Laravel side is a JsonResource, which
    // Laravel auto-wraps in {"data": ...} - the storefront's getSettings()
    // expects that same shape, so this must match even though our own
    // checkout/options route (a plain response()->json() on the Laravel
    // side, not a Resource) intentionally does NOT wrap.
    return { data: await this.settingsService.getPublicSettings() };
  }
}
