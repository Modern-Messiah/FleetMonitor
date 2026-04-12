import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType, Severity } from '../../common/domain.constants';

export class VehicleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  deviceId: string;

  @ApiProperty()
  driverName: string;

  @ApiProperty()
  licensePlate: string;

  @ApiProperty()
  isOnline: boolean;

  @ApiProperty()
  lastSeenAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  lat?: number;

  @ApiPropertyOptional()
  lng?: number;

  @ApiPropertyOptional()
  speed?: number;

  @ApiPropertyOptional()
  heading?: number;
}

export class GpsPointResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  vehicleId: string;

  @ApiProperty()
  lat: number;

  @ApiProperty()
  lng: number;

  @ApiProperty()
  speed: number;

  @ApiProperty()
  heading: number;

  @ApiProperty()
  timestamp: Date;
}

export class EventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  vehicleId: string;

  @ApiProperty({ enum: ['DROWSINESS', 'SPEEDING', 'HARSH_BRAKING', 'COLLISION_WARNING'] })
  type: EventType;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'CRITICAL'] })
  severity: Severity;

  @ApiProperty()
  lat: number;

  @ApiProperty()
  lng: number;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty()
  grouped: boolean;

  @ApiProperty()
  groupCount: number;

  @ApiPropertyOptional({ type: () => VehicleResponseDto })
  vehicle?: VehicleResponseDto;
}

export class VehicleDetailsResponseDto extends VehicleResponseDto {
  @ApiProperty({ type: [GpsPointResponseDto] })
  recentGps: GpsPointResponseDto[];

  @ApiProperty({ type: [EventResponseDto] })
  recentEvents: EventResponseDto[];
}

export class EventsListResponseDto {
  @ApiProperty({ type: [EventResponseDto] })
  items: EventResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
