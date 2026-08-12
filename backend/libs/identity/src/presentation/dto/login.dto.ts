import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DeviceInputDto {
  @IsUUID() clientDeviceId!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) browser?: string;
  @IsOptional() @IsString() @MaxLength(120) operatingSystem?: string;
}

export class LoginDto {
  @IsEmail() @MaxLength(320) email!: string;
  @IsString() @MaxLength(128) password!: string;
  @ValidateNested() @Type(() => DeviceInputDto) device!: DeviceInputDto;
}
