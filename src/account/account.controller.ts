import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentCustomer,
  CustomerAuthGuard,
} from '../customer-auth/customer-auth.guard.js';
import type { Customer } from '../customers/customer.entity.js';
import { AccountService } from './account.service.js';
import { StoreReviewDto } from './dto/review.dto.js';

/** Signed-in customer routes: orders, wishlist, reviews. */
@Controller('api/v1')
@UseGuards(CustomerAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('orders')
  orders(@CurrentCustomer() customer: Customer, @Query('page') page?: string) {
    return this.account.ordersIndex(customer, page);
  }

  @Get('orders/:id')
  order(
    @CurrentCustomer() customer: Customer,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.account.orderShow(customer, id);
  }

  @Get('wishlist')
  wishlist(@CurrentCustomer() customer: Customer) {
    return this.account.wishlistIndex(customer);
  }

  @Post('wishlist/:product/toggle')
  @HttpCode(200)
  toggleWishlist(
    @CurrentCustomer() customer: Customer,
    @Param('product', ParseIntPipe) product: number,
  ) {
    return this.account.wishlistToggle(customer, product);
  }

  @Post('products/:product/reviews')
  @HttpCode(201)
  storeReview(
    @CurrentCustomer() customer: Customer,
    @Param('product', ParseIntPipe) product: number,
    @Body() dto: StoreReviewDto,
  ) {
    return this.account.reviewStore(
      customer,
      product,
      dto.rating,
      dto.comment ?? null,
    );
  }

  @Delete('reviews/:id')
  destroyReview(
    @CurrentCustomer() customer: Customer,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.account.reviewDestroy(customer, id);
  }
}
