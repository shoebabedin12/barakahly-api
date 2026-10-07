import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class StoreReviewDto {
  @Max(5, { message: 'The rating field must not be greater than 5.' })
  @Min(1, { message: 'The rating field must be at least 1.' })
  @IsInt({ message: 'The rating field must be an integer.' })
  @Type(() => Number)
  @IsNotEmpty({ message: 'The rating field is required.' })
  rating: number;

  @IsOptional()
  @MaxLength(2000, {
    message: 'The comment field must not be greater than 2000 characters.',
  })
  @IsString({ message: 'The comment field must be a string.' })
  comment?: string | null;
}
