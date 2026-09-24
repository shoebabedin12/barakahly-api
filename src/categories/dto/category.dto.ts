import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CategoryDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsBoolean()
  status: boolean;

  @IsOptional()
  @IsInt()
  parentId?: number | null;
}
