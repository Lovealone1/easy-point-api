import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PageOptionsDto } from '../../../common/pagination/page-options.dto.js';
import { AuditAction } from '../enums/audit-action.enum.js';
import { AuditSeverity } from '../enums/audit-severity.enum.js';

export class QueryAuditLogDto extends PageOptionsDto {
  @ApiPropertyOptional({ description: 'Filter by user ID (UUID)' })
  @IsUUID()
  @IsOptional()
  readonly userId?: string;

  @ApiPropertyOptional({ description: 'Filter by action', enum: AuditAction })
  @IsEnum(AuditAction)
  @IsOptional()
  readonly action?: AuditAction;

  @ApiPropertyOptional({ description: 'Filter by resource type (e.g. "Client", "Sale")' })
  @IsString()
  @IsOptional()
  readonly resourceType?: string;

  @ApiPropertyOptional({ description: 'Filter by resource ID (UUID)' })
  @IsUUID()
  @IsOptional()
  readonly resourceId?: string;

  @ApiPropertyOptional({ enum: AuditSeverity })
  @IsEnum(AuditSeverity)
  @IsOptional()
  readonly severity?: AuditSeverity;

  @ApiPropertyOptional({
    description: 'ISO 8601 start date (inclusive)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  readonly startDate?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 end date (inclusive)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  readonly endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by request ID for request-level correlation' })
  @IsString()
  @IsOptional()
  readonly requestId?: string;
}
