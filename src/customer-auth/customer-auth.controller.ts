import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { publicImageUpload } from '../common/public-storage.js';
import type { Customer } from '../customers/customer.entity.js';
import {
  CurrentCustomer,
  CustomerAuthGuard,
  type CustomerRequest,
} from './customer-auth.guard.js';
import { CustomerAuthService } from './customer-auth.service.js';
import {
  DeleteAccountDto,
  LoginDto,
  PasskeyLoginDto,
  PasskeyRegisterDto,
  RegisterDto,
  UpdatePasswordDto,
  UpdateProfileDto,
} from './dto/customer-auth.dto.js';
import { PasskeysService } from './passkeys.service.js';

const AVATAR_TYPES = ['.jpg', '.jpeg', '.png', '.webp'];

/** Mirrors Api\V1\AuthController (customer accounts + passkeys). */
@Controller('api/v1/auth')
export class CustomerAuthController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly passkeys: PasskeysService,
  ) {}

  @Post('register')
  @HttpCode(201)
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('passkeys/login-options')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  passkeyLoginOptions() {
    return this.passkeys.loginOptions();
  }

  @Post('passkeys/login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async passkeyLogin(@Body() dto: PasskeyLoginDto) {
    const customer = await this.passkeys.verifyLogin(
      dto.ticket,
      dto.credential,
    );
    this.auth.assertActive(customer);
    return this.auth.signIn(customer, dto.guest_token);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(CustomerAuthGuard)
  logout(@Req() request: CustomerRequest) {
    return this.auth.logout(request.customerTokenId as number);
  }

  @Get('me')
  @UseGuards(CustomerAuthGuard)
  async me(@CurrentCustomer() customer: Customer) {
    return { customer: await this.auth.present(customer) };
  }

  @Patch('profile')
  @UseGuards(CustomerAuthGuard)
  updateProfile(
    @CurrentCustomer() customer: Customer,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(customer, dto);
  }

  @Patch('password')
  @UseGuards(CustomerAuthGuard)
  updatePassword(
    @CurrentCustomer() customer: Customer,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.auth.updatePassword(customer, dto);
  }

  @Post('avatar')
  @HttpCode(200)
  @UseGuards(CustomerAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', publicImageUpload('avatars', 2048, AVATAR_TYPES)),
  )
  uploadAvatar(
    @CurrentCustomer() customer: Customer,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.auth.setAvatar(customer, avatar);
  }

  @Delete('account')
  @UseGuards(CustomerAuthGuard)
  deleteAccount(
    @CurrentCustomer() customer: Customer,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.auth.deleteAccount(customer, dto.password);
  }

  @Delete('avatar')
  @UseGuards(CustomerAuthGuard)
  removeAvatar(@CurrentCustomer() customer: Customer) {
    return this.auth.removeAvatar(customer);
  }

  @Get('passkeys')
  @UseGuards(CustomerAuthGuard)
  listPasskeys(@CurrentCustomer() customer: Customer) {
    return this.passkeys.list(customer);
  }

  @Post('passkeys/register-options')
  @HttpCode(200)
  @UseGuards(CustomerAuthGuard)
  passkeyRegistrationOptions(@CurrentCustomer() customer: Customer) {
    return this.passkeys.registrationOptions(customer);
  }

  @Post('passkeys/register')
  @HttpCode(201)
  @UseGuards(CustomerAuthGuard)
  registerPasskey(
    @CurrentCustomer() customer: Customer,
    @Body() dto: PasskeyRegisterDto,
  ) {
    return this.passkeys.register(
      customer,
      dto.name,
      dto.ticket,
      dto.credential,
    );
  }

  @Delete('passkeys/:id')
  @UseGuards(CustomerAuthGuard)
  destroyPasskey(
    @CurrentCustomer() customer: Customer,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.passkeys.destroy(customer, id);
  }
}
