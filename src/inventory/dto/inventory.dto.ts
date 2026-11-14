import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
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
const date = (field: string) => ({
  message: `The ${field} field must be a valid date.`,
});
const atLeast = (field: string, n: number) => ({
  message: `The ${field} field must be at least ${n}.`,
});
/** Empty strings from forms mean "not set". */
const emptyToNull = () =>
  Transform(({ value }) => (value === '' ? null : value));

// ---------------------------------------------------------------- suppliers

export class SupplierDto {
  @MaxLength(255, max('name', 255))
  @IsString()
  @IsNotEmpty(required('name'))
  name: string;

  @emptyToNull()
  @IsOptional()
  @MaxLength(255, max('phone', 255))
  @IsString()
  phone?: string | null;

  @emptyToNull()
  @ValidateIf((dto: SupplierDto) => dto.email != null)
  @MaxLength(255, max('email', 255))
  @IsEmail({}, { message: 'The email field must be a valid email address.' })
  email?: string | null;

  @emptyToNull()
  @IsOptional()
  @MaxLength(255, max('company name', 255))
  @IsString()
  companyName?: string | null;

  @emptyToNull()
  @IsOptional()
  @IsString()
  address?: string | null;

  @IsBoolean()
  status: boolean;
}

export class SupplierPaymentDto {
  @Min(1, atLeast('amount', 1))
  @IsNumber({}, numeric('amount'))
  @Type(() => Number)
  amount: number;

  @IsDateString({}, date('payment date'))
  @IsNotEmpty(required('payment date'))
  paymentDate: string;

  @emptyToNull()
  @IsOptional()
  @MaxLength(255, max('payment method', 255))
  @IsString()
  paymentMethod?: string | null;

  @emptyToNull()
  @IsOptional()
  @IsString()
  note?: string | null;
}

// ---------------------------------------------------------------- purchases

export class PurchaseItemDto {
  @IsInt(required('product'))
  @Type(() => Number)
  productId: number;

  /** Required when the product has variants. */
  @Transform(({ value }) => (value === '' || value == null ? null : Number(value)))
  @IsOptional()
  @IsInt({ message: 'The selected variant is invalid.' })
  variantId?: number | null;

  @Min(1, atLeast('quantity', 1))
  @IsInt({ message: 'The quantity field must be an integer.' })
  @Type(() => Number)
  quantity: number;

  @Min(0, atLeast('price', 0))
  @IsNumber({}, numeric('price'))
  @Type(() => Number)
  price: number;
}

export class PurchaseCostLineDto {
  @MaxLength(255, max('cost title', 255))
  @IsString()
  @IsNotEmpty(required('cost title'))
  title: string;

  @Min(0, atLeast('cost amount', 0))
  @IsNumber({}, numeric('cost amount'))
  @Type(() => Number)
  amount: number;
}

export class PurchaseDto {
  @IsInt(required('supplier'))
  @Type(() => Number)
  supplierId: number;

  @IsDateString({}, date('purchase date'))
  @IsNotEmpty(required('purchase date'))
  purchaseDate: string;

  @IsIn(['pending', 'completed', 'cancelled'], {
    message: 'The selected status is invalid.',
  })
  status: 'pending' | 'completed' | 'cancelled';

  @IsIn(['business', 'investment'], {
    message: 'The selected funding source is invalid.',
  })
  fundingSource: 'business' | 'investment';

  @ValidateIf((dto: PurchaseDto) => dto.fundingSource === 'investment')
  @IsInt({ message: 'The investment field is required when funding source is investment.' })
  @Type(() => Number)
  investmentId?: number | null;

  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: 'Add at least one product.' })
  @IsArray(required('products'))
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  /** Extra costs entered with a new purchase; edits manage costs on the detail page. */
  @IsOptional()
  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => PurchaseCostLineDto)
  costs?: PurchaseCostLineDto[];
}

export class PurchasePaymentDto {
  @Min(1, atLeast('amount', 1))
  @IsNumber({}, numeric('amount'))
  @Type(() => Number)
  amount: number;
}

export class PurchaseCostDto extends PurchaseCostLineDto {
  @IsDateString({}, date('cost date'))
  @IsNotEmpty(required('cost date'))
  costDate: string;
}

// -------------------------------------------------------------- investments

export class InvestmentDto {
  @MaxLength(255, max('investor name', 255))
  @IsString()
  @IsNotEmpty(required('investor name'))
  investorName: string;

  @Min(0.01, atLeast('amount', 0.01))
  @IsNumber({}, numeric('amount'))
  @Type(() => Number)
  amount: number;

  @IsDateString({}, date('invested date'))
  @IsNotEmpty(required('invested date'))
  investedDate: string;

  @emptyToNull()
  @IsOptional()
  @IsString()
  note?: string | null;
}
