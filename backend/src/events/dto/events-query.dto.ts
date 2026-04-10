import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventType, Severity } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class EventsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional({ enum: Severity })
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: 'Search by driver name or license plate' })
  @IsOptional()
  @IsString()
  search?: string;
}
