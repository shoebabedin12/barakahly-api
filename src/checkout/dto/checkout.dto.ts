import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const required = (field: string) => ({
  message: `The ${field} field is required.`,
});
const string = (field: string) => ({
  message: `The ${field} field must be a string.`,
});
const max = (field: string, n: number) => ({
  message: `The ${field} field must not be greater than ${n} characters.`,
});
const email = { message: 'The email field must be a valid email address.' };

export class SendOtpDto {
  @MaxLength(255, max('email', 255))
  @IsEmail({}, email)
  @IsNotEmpty(required('email'))
  email: string;
}

export class VerifyOtpDto {
  @MaxLength(255, max('email', 255))
  @IsEmail({}, email)
  @IsNotEmpty(required('email'))
  email: string;

  @IsString(string('code'))
  @IsNotEmpty(required('code'))
  code: string;
}

export class ApplyCouponDto {
  @IsString(string('coupon code'))
  @IsNotEmpty(required('coupon code'))
  coupon_code: string;
}

export class PlaceOrderDto {
  @MaxLength(255, max('name', 255))
  @IsString(string('name'))
  @IsNotEmpty(required('name'))
  name: string;

  @MaxLength(20, max('phone', 20))
  @IsString(string('phone'))
  @IsNotEmpty(required('phone'))
  phone: string;

  @MaxLength(255, max('email', 255))
  @IsEmail({}, email)
  @IsNotEmpty(required('email'))
  email: string;

  @IsString(string('address'))
  @IsNotEmpty(required('address'))
  address: string;

  @IsInt({ message: 'The selected payment method id is invalid.' })
  @Type(() => Number)
  @IsNotEmpty(required('payment method id'))
  payment_method_id: number;

  @IsInt({ message: 'The selected shipping zone id is invalid.' })
  @Type(() => Number)
  @IsNotEmpty(required('shipping zone id'))
  shipping_zone_id: number;

  @IsOptional()
  @IsString(string('coupon code'))
  coupon_code?: string | null;

  // Required for guests only - checked in the service.
  @IsOptional()
  @IsString(string('verify token'))
  verify_token?: string | null;

  @IsOptional()
  password?: string | null;

  @IsOptional()
  password_confirmation?: string | null;

  // Required when the payment method needs a transaction id - checked in the service.
  @IsOptional()
  transaction_id?: string | null;

  @IsOptional()
  payment_date?: string | null;
}
