import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  SecuritySeverityFilter,
  VideoOperationStatus,
} from '../../application';

export class PageQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

const VIDEO_STATUSES: VideoOperationStatus[] = [
  'UPLOADING',
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
  'DELETING',
  'DELETED',
];

export class VideoOperationsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(VIDEO_STATUSES)
  status?: VideoOperationStatus;
}

export class AuditLogQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetType?: string;
}

const SECURITY_SEVERITIES: SecuritySeverityFilter[] = [
  'INFO',
  'WARNING',
  'HIGH',
  'CRITICAL',
];

export class SecurityEventQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(SECURITY_SEVERITIES)
  severity?: SecuritySeverityFilter;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  unresolvedOnly?: boolean;
}
