import { IsString, MaxLength, MinLength } from 'class-validator';

export class TrackOrderDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  order_number: string;

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  phone: string;
}
