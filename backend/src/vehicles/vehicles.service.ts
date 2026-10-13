import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisService, VehicleState } from '../cache/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { VEHICLE_REGISTRY_MAP } from '../common/vehicle-registry';

interface StoredFix {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: Date;
}

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getOrCreateByDeviceId(deviceId: string) {
    const existing = await this.prisma.vehicle.findUnique({ where: { deviceId } });
    if (existing) {
      return existing;
    }

    const seed = VEHICLE_REGISTRY_MAP.get(deviceId);

    return this.prisma.vehicle.create({
      data: {
        deviceId,
        driverName: seed?.driverName ?? `Driver ${deviceId}`,
        licensePlate: seed?.licensePlate ?? `KZ ${deviceId}`,
      },
    });
  }

  async touchOnline(vehicleId: string, at: Date) {
    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        isOnline: true,
        lastSeenAt: at,
      },
    });
  }

  async markStaleOffline(maxSilenceSeconds: number) {
    const threshold = new Date(Date.now() - maxSilenceSeconds * 1000);

    const staleVehicles = await this.prisma.vehicle.findMany({
      where: {
        isOnline: true,
        lastSeenAt: {
          lt: threshold,
        },
      },
      select: {
        id: true,
      },
    });

    if (staleVehicles.length === 0) {
      return [];
    }

    await this.prisma.vehicle.updateMany({
      where: {
        id: {
          in: staleVehicles.map((vehicle: { id: string }) => vehicle.id),
        },
      },
      data: {
        isOnline: false,
      },
    });

    return staleVehicles;
  }

  async findAllWithState() {
    const vehicles = await this.prisma.vehicle.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const liveStates = await Promise.all(
      vehicles.map((vehicle) => this.redisService.getVehicleState(vehicle.deviceId)),
    );
    const missingIds = vehicles.filter((_, index) => !liveStates[index]).map((vehicle) => vehicle.id);
    const remembered = await this.latestFixByVehicle(missingIds);

    return vehicles.map((vehicle, index) => {
      const live = liveStates[index];
      const fix = remembered.get(vehicle.id);
      return {
        ...vehicle,
        isOnline: Boolean(live),
        state: live ?? (fix ? this.toState(fix) : null),
      };
    });
  }

  async findOneWithTelemetry(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const [state, gpsPoints, events] = await Promise.all([
      this.redisService.getVehicleState(vehicle.deviceId),
      this.prisma.gpsPoint.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { timestamp: 'desc' },
        take: 10,
      }),
      this.prisma.event.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
    ]);

    const fix = gpsPoints[0];
    return {
      ...vehicle,
      isOnline: Boolean(state),
      state: state ?? (fix ? this.toState(fix) : null),
      gpsPoints,
      events,
    };
  }

  private async latestFixByVehicle(vehicleIds: string[]) {
    const found = new Map<string, StoredFix>();
    if (vehicleIds.length === 0) {
      return found;
    }

    const points = await this.prisma.gpsPoint.findMany({
      where: { vehicleId: { in: vehicleIds } },
      distinct: ['vehicleId'],
      orderBy: [{ vehicleId: 'asc' }, { timestamp: 'desc' }],
      select: {
        vehicleId: true,
        lat: true,
        lng: true,
        speed: true,
        heading: true,
        timestamp: true,
      },
    });

    points.forEach((point) => {
      found.set(point.vehicleId, point);
    });
    return found;
  }

  private toState(point: StoredFix): VehicleState {
    return {
      lat: point.lat,
      lng: point.lng,
      speed: point.speed,
      heading: point.heading,
      timestamp: point.timestamp.toISOString(),
    };
  }
}
