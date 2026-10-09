import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
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

export class RegisterDto {
  @MaxLength(255, max('name', 255))
  @IsString(string('name'))
  @IsNotEmpty(required('name'))
  name: string;

  @MaxLength(20, max('phone', 20))
  @IsString(string('phone'))
  @IsNotEmpty(required('phone'))
  phone: string;

  @ValidateIf(
    (dto: RegisterDto) =>
      dto.email !== null && dto.email !== undefined && dto.email !== '',
  )
  @MaxLength(255, max('email', 255))
  @IsEmail({}, email)
  email?: string | null;

  @IsOptional()
  @IsString(string('address'))
  address?: string | null;

  // Strength + confirmation are checked in the service (passwordErrors).
  @IsOptional()
  password?: string;

  @IsOptional()
  password_confirmation?: string;

  @IsOptional()
  @IsString()
  guest_token?: string | null;
}

export class LoginDto {
  @IsString(string('login'))
  @IsNotEmpty(required('login'))
  login: string;

  @IsString(string('password'))
  @IsNotEmpty(required('password'))
  password: string;

  @IsOptional()
  @IsString()
  guest_token?: string | null;
}

export class UpdateProfileDto {
  @MaxLength(255, max('name', 255))
  @IsString(string('name'))
  @IsNotEmpty(required('name'))
  name: string;

  @MaxLength(20, max('phone', 20))
  @IsString(string('phone'))
  @IsNotEmpty(required('phone'))
  phone: string;

  @ValidateIf(
    (dto: UpdateProfileDto) =>
      dto.email !== null && dto.email !== undefined && dto.email !== '',
  )
  @MaxLength(255, max('email', 255))
  @IsEmail({}, email)
  email?: string | null;

  @IsOptional()
  @IsString(string('address'))
  address?: string | null;

  @IsOptional()
  @MaxLength(255, max('city', 255))
  @IsString(string('city'))
  city?: string | null;
}

export class UpdatePasswordDto {
  @IsString(string('current password'))
  @IsNotEmpty(required('current password'))
  current_password: string;

  @IsOptional()
  password?: string;

  @IsOptional()
  password_confirmation?: string;
}

export class PasskeyRegisterDto {
  @MaxLength(255, max('name', 255))
  @IsString(string('name'))
  @IsNotEmpty(required('name'))
  name: string;

  @IsString(string('ticket'))
  @IsNotEmpty(required('ticket'))
  ticket: string;

  @IsObject({ message: 'The credential field must be an array.' })
  credential: Record<string, unknown>;
}

export class PasskeyLoginDto {
  @IsString(string('ticket'))
  @IsNotEmpty(required('ticket'))
  ticket: string;

  @IsObject({ message: 'The credential field must be an array.' })
  credential: Record<string, unknown>;

  @IsOptional()
  @IsString()
  guest_token?: string | null;
}

export class DeleteAccountDto {
  @IsOptional()
  @IsString(string('password'))
  password?: string;
}
