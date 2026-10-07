import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class AddCartItemDto {
  @Type(() => Number)
  @IsInt({ message: 'The product id field must be an integer.' })
  product_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'The variant id field must be an integer.' })
  variant_id?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'The quantity field must be an integer.' })
  @Min(1, { message: 'The quantity field must be at least 1.' })
  quantity?: number;
}

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInt({ message: 'The quantity field must be an integer.' })
  @Min(1, { message: 'The quantity field must be at least 1.' })
  quantity: number;
}
