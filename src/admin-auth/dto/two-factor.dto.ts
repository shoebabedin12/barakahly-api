import { IsString, MaxLength, MinLength } from 'class-validator';

export class TwoFactorChallengeDto {
  @IsString()
  challengeToken: string;

  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code: string;
}

export class TwoFactorEnableDto {
  @IsString()
  setupToken: string;

  @IsString()
  @MinLength(6)
  @MaxLength(10)
  code: string;
}

export class TwoFactorDisableDto {
  @IsString()
  @MinLength(1)
  password: string;
}
