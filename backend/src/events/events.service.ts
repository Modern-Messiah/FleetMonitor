import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import { EventType, Severity } from '../common/domain.constants';
import { PrismaService } from '../prisma/prisma.service';
import { EventsQueryDto } from './dto/events-query.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: EventsQueryDto) {
    const where = this.buildWhere(query);
    const page = query.page || 1;
    const limit = query.limit || 20;

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          vehicle: {
            select: {
              id: true,
              deviceId: true,
              driverName: true,
              licensePlate: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async exportCsv(query: EventsQueryDto) {
    const where = this.buildWhere(query);

    const items = await this.prisma.event.findMany({
      where,
      include: {
        vehicle: {
          select: {
            deviceId: true,
            driverName: true,
            licensePlate: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    return stringify(
      items.map((event: any) => ({
        id: event.id,
        timestamp: event.timestamp.toISOString(),
        deviceId: event.vehicle.deviceId,
        driverName: event.vehicle.driverName,
        licensePlate: event.vehicle.licensePlate,
        type: event.type,
        severity: event.severity,
        lat: event.lat,
        lng: event.lng,
        groupCount: event.groupCount,
      })),
      {
        header: true,
        columns: [
          'id',
          'timestamp',
          'deviceId',
          'driverName',
          'licensePlate',
          'type',
          'severity',
          'lat',
          'lng',
          'groupCount',
        ],
      },
    );
  }

  private buildWhere(query: EventsQueryDto) {
    const where: any = {};

    if (query.vehicleId) {
      where.vehicleId = query.vehicleId;
    }

    if (query.type) {
      where.type = query.type as EventType;
    }

    if (query.severity) {
      where.severity = query.severity as Severity;
    }

    if (query.dateFrom || query.dateTo) {
      where.timestamp = {};
      if (query.dateFrom) {
        where.timestamp.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.timestamp.lte = new Date(query.dateTo);
      }
    }

    if (query.search) {
      where.OR = [
        {
          vehicle: {
            driverName: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        },
        {
          vehicle: {
            licensePlate: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    return where;
  }
}
