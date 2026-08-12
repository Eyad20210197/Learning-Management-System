import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { EnrollmentStatus, LessonType } from '../../domain';

export class CourseWriteDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(200)
  slug!: string;
  @IsString() @MinLength(1) @MaxLength(20_000) description!: string;
}
export class SectionWriteDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string | null;
}
export class LessonWriteDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(10_000) description?: string | null;
  @IsEnum(['VIDEO', 'TEXT']) type!: LessonType;
  @ValidateIf((object: LessonWriteDto) => object.type === 'TEXT')
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  textContent?: string | null;
}
export class OrderedIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
export class EnrollmentWriteDto {
  @IsUUID() userId!: string;
  @Type(() => Date) @IsDate() startsAt!: Date;
  @IsOptional() @Type(() => Date) @IsDate() expiresAt?: Date | null;
  @IsOptional() @IsEnum(['ACTIVE', 'SUSPENDED']) status?: Extract<
    EnrollmentStatus,
    'ACTIVE' | 'SUSPENDED'
  >;
}
export class ProgressDto {
  @IsInt() @Min(0) positionSeconds!: number;
  @IsInt() @Min(0) watchedSeconds!: number;
}

export class StudentSearchDto {
  @IsOptional() @IsString() @MaxLength(200) query?: string;
}
