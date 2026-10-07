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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard.js';
import { publicImageUpload } from '../common/public-storage.js';
import { pageNumber } from './admin-page.js';
import { CustomersAdminService } from './customers-admin.service.js';
import {
  CouponAdminDto,
  CustomerAdminDto,
  PaymentMethodAdminDto,
  ShippingZoneAdminDto,
} from './dto/store-admin.dto.js';
import {
  BannersAdminService,
  CouponsAdminService,
  parseBannerForm,
  PaymentMethodsAdminService,
  ReviewsAdminService,
  SettingsAdminService,
  ShippingZonesAdminService,
} from './store-admin.services.js';

@Controller('api/v1/admin/customers')
@UseGuards(AdminJwtGuard)
export class CustomersAdminController {
  constructor(private readonly service: CustomersAdminService) {}

  @Get()
  findAll(@Query('page') page?: string, @Query('search') search?: string) {
    return this.service.findAll(pageNumber(page), search);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CustomerAdminDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CustomerAdminDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Customer deleted successfully.' };
  }
}

@Controller('api/v1/admin/coupons')
@UseGuards(AdminJwtGuard)
export class CouponsAdminController {
  constructor(private readonly service: CouponsAdminService) {}

  @Get()
  findAll(@Query('page') page?: string) {
    return this.service.findAll(pageNumber(page));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CouponAdminDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CouponAdminDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Coupon deleted successfully.' };
  }
}

@Controller('api/v1/admin/payment-methods')
@UseGuards(AdminJwtGuard)
export class PaymentMethodsAdminController {
  constructor(private readonly service: PaymentMethodsAdminService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: PaymentMethodAdminDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PaymentMethodAdminDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Payment method deleted successfully.' };
  }
}

@Controller('api/v1/admin/shipping-zones')
@UseGuards(AdminJwtGuard)
export class ShippingZonesAdminController {
  constructor(private readonly service: ShippingZonesAdminService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: ShippingZoneAdminDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ShippingZoneAdminDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Shipping zone deleted successfully.' };
  }
}

@Controller('api/v1/admin/banners')
@UseGuards(AdminJwtGuard)
export class BannersAdminController {
  constructor(private readonly service: BannersAdminService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', publicImageUpload('banners')))
  create(
    @Body() body: Record<string, string>,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.service.create(parseBannerForm(body), image);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image', publicImageUpload('banners')))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, string>,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.service.update(id, parseBannerForm(body), image);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Banner deleted successfully.' };
  }
}

@Controller('api/v1/admin/reviews')
@UseGuards(AdminJwtGuard)
export class ReviewsAdminController {
  constructor(private readonly service: ReviewsAdminService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('rating') rating?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(pageNumber(page), rating, status);
  }

  @Patch(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number) {
    return this.service.toggle(id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return { message: 'Review deleted successfully.' };
  }
}

@Controller('api/v1/admin/settings')
@UseGuards(AdminJwtGuard)
export class SettingsAdminController {
  constructor(private readonly service: SettingsAdminService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'favicon', maxCount: 1 },
      ],
      publicImageUpload('branding'),
    ),
  )
  update(
    @Body() body: Record<string, string>,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; favicon?: Express.Multer.File[] },
  ) {
    return this.service.update(body, files ?? {});
  }
}
