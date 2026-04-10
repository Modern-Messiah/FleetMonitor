import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisService } from '../cache/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { VEHICLE_REGISTRY_MAP } from '../common/vehicle-registry';

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

    return Promise.all(
      vehicles.map(async (vehicle: any) => {
        const state = await this.redisService.getVehicleState(vehicle.deviceId);
        return {
          ...vehicle,
          isOnline: Boolean(state),
          state,
        };
      }),
    );
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

    return {
      ...vehicle,
      isOnline: Boolean(state),
      state,
      gpsPoints,
      events,
    };
  }
}
