import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class BrandDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsBoolean()
  status: boolean;
}
