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
      items.map((event: any) => {
        let typeRu = event.type;
        if (typeRu === 'DROWSINESS') typeRu = 'Сонливость';
        else if (typeRu === 'SPEEDING') typeRu = 'Превышение скорости';
        else if (typeRu === 'HARSH_BRAKING') typeRu = 'Резкое торможение';
        else if (typeRu === 'COLLISION_WARNING') typeRu = 'Опасность столкновения';

        let severityRu = event.severity;
        if (severityRu === 'LOW') severityRu = 'Низкий';
        else if (severityRu === 'MEDIUM') severityRu = 'Средний';
        else if (severityRu === 'CRITICAL') severityRu = 'Критический';

        return {
          'ID': event.id,
          'Время': new Date(event.timestamp).toLocaleString('ru-RU'),
          'Трекер': event.vehicle.deviceId,
          'Водитель': event.vehicle.driverName,
          'Номер авто': event.vehicle.licensePlate,
          'Тип события': typeRu,
          'Уровень': severityRu,
          'Широта': event.lat,
          'Долгота': event.lng,
          'Количество': event.groupCount,
        };
      }),
      {
        header: true,
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
