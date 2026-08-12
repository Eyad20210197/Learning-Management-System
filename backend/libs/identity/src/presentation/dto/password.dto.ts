import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail() @MaxLength(320) email!: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(32) token!: string;
  @IsString() @MinLength(12) @MaxLength(128) newPassword!: string;
}

export class ChangePasswordDto {
  @IsString() @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(12) @MaxLength(128) newPassword!: string;
}
