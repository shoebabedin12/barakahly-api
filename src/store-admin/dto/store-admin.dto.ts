import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const required = (field: string) => ({
  message: `The ${field} field is required.`,
});
const max = (field: string, n: number) => ({
  message: `The ${field} field must not be greater than ${n} characters.`,
});
const numeric = (field: string) => ({
  message: `The ${field} field must be a number.`,
});
/** Empty strings from forms mean "not set". */
const emptyToNull = () =>
  Transform(({ value }) => (value === '' ? null : value));
/** Optional numeric form field: blank means null, anything else is coerced to a number. */
const optionalNumber = () =>
  Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? null
      : Number(value),
  );
const present = (field: string) => (dto: Record<string, unknown>) =>
  dto[field] !== null && dto[field] !== undefined;

export class CustomerAdminDto {
  @MaxLength(255, max('name', 255))
  @IsString()
  @IsNotEmpty(required('name'))
  name: string;

  @MaxLength(20, max('phone', 20))
  @IsString()
  @IsNotEmpty(required('phone'))
  phone: string;

  @emptyToNull()
  @ValidateIf(present('email'))
  @MaxLength(255, max('email', 255))
  @IsEmail({}, { message: 'The email field must be a valid email address.' })
  email?: string | null;

  @emptyToNull()
  @IsOptional()
  @IsString()
  address?: string | null;

  @emptyToNull()
  @IsOptional()
  @MaxLength(255, max('city', 255))
  @IsString()
  city?: string | null;

  @IsBoolean()
  status: boolean;

  /** Optional: sets (or replaces) the customer's login password. */
  @emptyToNull()
  @IsOptional()
  @IsString()
  password?: string | null;

  @IsOptional()
  @IsString()
  passwordConfirmation?: string | null;
}

export class CouponAdminDto {
  @MaxLength(255, max('code', 255))
  @IsString()
  @IsNotEmpty(required('code'))
  code: string;

  @IsIn(['fixed', 'percentage'], { message: 'The selected type is invalid.' })
  type: 'fixed' | 'percentage';

  @Min(0, { message: 'The value field must be at least 0.' })
  @IsNumber({}, numeric('value'))
  @Type(() => Number)
  value: number;

  @optionalNumber()
  @IsOptional()
  @Min(0)
  @IsNumber({}, numeric('min order amount'))
  minOrderAmount?: number | null;

  @optionalNumber()
  @IsOptional()
  @Min(0)
  @IsNumber({}, numeric('max discount'))
  maxDiscount?: number | null;

  @emptyToNull()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'The start date field must be a valid date.',
  })
  startDate?: string | null;

  @emptyToNull()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'The end date field must be a valid date.',
  })
  endDate?: string | null;

  @optionalNumber()
  @IsOptional()
  @Min(1)
  @IsInt({ message: 'The usage limit field must be an integer.' })
  usageLimit?: number | null;

  @IsBoolean()
  status: boolean;
}

export class PaymentMethodAdminDto {
  @MaxLength(255, max('name', 255))
  @IsString()
  @IsNotEmpty(required('name'))
  name: string;

  @Matches(/^[A-Za-z0-9_-]+$/, {
    message:
      'The code field must only contain letters, numbers, dashes, and underscores.',
  })
  @MaxLength(50, max('code', 50))
  @IsNotEmpty(required('code'))
  code: string;

  @emptyToNull()
  @IsOptional()
  @IsString()
  instructions?: string | null;

  @emptyToNull()
  @IsOptional()
  @MaxLength(1000, max('receiving number', 1000))
  @IsString()
  receivingNumber?: string | null;

  @optionalNumber()
  @IsOptional()
  @IsInt({ message: 'The sort order field must be an integer.' })
  sortOrder?: number | null;

  @IsBoolean()
  requiresTransactionId: boolean;

  @IsBoolean()
  status: boolean;
}

export class ShippingZoneAdminDto {
  @MaxLength(255, max('name', 255))
  @IsString()
  @IsNotEmpty(required('name'))
  name: string;

  @Min(0, { message: 'The charge field must be at least 0.' })
  @IsNumber({}, numeric('charge'))
  @Type(() => Number)
  charge: number;

  @IsBoolean()
  status: boolean;
}
