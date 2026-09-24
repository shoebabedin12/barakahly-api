import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class SizeDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsBoolean()
  status: boolean;
}
