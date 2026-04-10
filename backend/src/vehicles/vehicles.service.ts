import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VEHICLE_REGISTRY_MAP } from '../common/vehicle-registry';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

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
}
