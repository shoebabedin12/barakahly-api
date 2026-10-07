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
  UseGuards,
} from '@nestjs/common';
import {
  type CustomerRequest,
  OptionalCustomerGuard,
} from '../customer-auth/customer-auth.guard.js';
import { CartService, resolveCartOwner } from './cart.service.js';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto.js';

/**
 * Mirrors Api\V1\CartController. Works for signed-in customers and for guests
 * (X-Guest-Token header; a new token is minted and echoed back when absent).
 */
@Controller('api/v1/cart')
@UseGuards(OptionalCustomerGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  index(@Req() request: CustomerRequest) {
    return this.cart.cartResponse(resolveCartOwner(request));
  }

  @Post('items')
  @HttpCode(201)
  async store(@Req() request: CustomerRequest, @Body() dto: AddCartItemDto) {
    const owner = resolveCartOwner(request);
    await this.cart.add(
      owner,
      dto.product_id,
      dto.variant_id ?? null,
      dto.quantity ?? 1,
    );
    return this.cart.cartResponse(owner);
  }

  @Patch('items/:id')
  async update(
    @Req() request: CustomerRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    const owner = resolveCartOwner(request);
    await this.cart.update(owner, id, dto.quantity);
    return this.cart.cartResponse(owner);
  }

  @Delete('items/:id')
  async destroy(
    @Req() request: CustomerRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const owner = resolveCartOwner(request);
    await this.cart.remove(owner, id);
    return this.cart.cartResponse(owner);
  }

  @Delete()
  async clear(@Req() request: CustomerRequest) {
    const owner = resolveCartOwner(request);
    await this.cart.clear(owner);
    return this.cart.cartResponse(owner);
  }
}
