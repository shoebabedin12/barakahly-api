import { Transform, Type } from 'class-transformer';
import { IsArray, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const emptyToNull = () => Transform(({ value }) => (value === '' ? null : value));

export class StaffUserDto {
  @MaxLength(255, { message: 'The name field must not be greater than 255 characters.' })
  @IsString()
  @IsNotEmpty({ message: 'The name field is required.' })
  name: string;

  @MaxLength(255, { message: 'The email field must not be greater than 255 characters.' })
  @IsEmail({}, { message: 'The email field must be a valid email address.' })
  @IsNotEmpty({ message: 'The email field is required.' })
  email: string;

  @IsInt({ message: 'The role field is required.' })
  @Type(() => Number)
  roleId: number;

  /** Required for new accounts; blank on edit keeps the current password. */
  @emptyToNull()
  @IsOptional()
  @IsString()
  password?: string | null;

  @emptyToNull()
  @IsOptional()
  @IsString()
  passwordConfirmation?: string | null;
}

export class RoleDto {
  @MaxLength(255, { message: 'The name field must not be greater than 255 characters.' })
  @IsString()
  @IsNotEmpty({ message: 'The name field is required.' })
  name: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true, message: 'The selected permissions are invalid.' })
  @Type(() => Number)
  permissionIds?: number[];
}
