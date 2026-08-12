import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Max,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VideoUploadDto {
  @IsString() @MinLength(1) @MaxLength(255) filename!: string;
  @IsIn(['video/mp4', 'video/quicktime', 'video/x-matroska'])
  mimeType!: string;
  @IsInt() @Min(1) sizeBytes!: number;
}

export class LessonResourceUploadDto {
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsString() @MinLength(1) @MaxLength(255) filename!: string;
  @IsIn([
    'application/pdf',
    'text/plain',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ])
  mimeType!: string;
  @IsInt() @Min(1) @Max(104_857_600) sizeBytes!: number;
}

export class MultipartPartDto {
  @IsInt() @Min(1) @Max(10_000) partNumber!: number;
  @IsString() @Matches(/^"?[a-fA-F0-9-]{1,128}"?$/) etag!: string;
}

export class CompleteMultipartUploadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10_000)
  @ValidateNested({ each: true })
  @Type(() => MultipartPartDto)
  parts!: MultipartPartDto[];
}
