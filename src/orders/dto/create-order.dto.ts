import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsInt()
  productId: number;

  @IsOptional()
  @IsInt()
  variantId?: number | null;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;
}

/** Admin\OrderController@store - an order taken by phone, WhatsApp or Facebook. */
export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  customerName: string;

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  customerPhone: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  customerEmail?: string | null;

  @IsString()
  @MinLength(1)
  shippingAddress: string;

  @IsOptional()
  @IsInt()
  shippingZoneId?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCharge?: number | null;

  @IsInt()
  paymentMethodId: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
