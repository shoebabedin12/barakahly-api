import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class ContactDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MaxLength(5000)
  message: string;
}
