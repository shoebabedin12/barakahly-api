import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/customer.entity.js';
import {
  CustomerAuthGuard,
  OptionalCustomerGuard,
} from './customer-auth.guard.js';
import { PersonalAccessToken } from './personal-access-token.entity.js';
import { SanctumTokenService } from './sanctum-token.service.js';

/** Token issuing + the customer guards, shared by every storefront module. */
@Module({
  imports: [TypeOrmModule.forFeature([PersonalAccessToken, Customer])],
  providers: [SanctumTokenService, CustomerAuthGuard, OptionalCustomerGuard],
  exports: [SanctumTokenService, CustomerAuthGuard, OptionalCustomerGuard],
})
export class CustomerTokensModule {}
