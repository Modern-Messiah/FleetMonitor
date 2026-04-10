import {
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../cache/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';

interface GpsUpdatePayload {
  vehicleId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: string;
}

interface EventNewPayload {
  id: string;
  vehicleId: string;
  type: string;
  severity: string;
  lat: number;
  lng: number;
  timestamp: string;
  groupCount: number;
}

interface VehicleStatusPayload {
  vehicleId: string;
  isOnline: boolean;
}

@WebSocketGateway({
  namespace: '/fleet',
  cors: {
    origin: '*',
  },
})
export class FleetGateway
  implements OnGatewayConnection, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(FleetGateway.name);
  private offlineInterval?: NodeJS.Timeout;

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  onModuleInit() {
    this.offlineInterval = setInterval(() => {
      void this.emitOfflineStatuses();
    }, 5000);
  }

  onModuleDestroy() {
    if (this.offlineInterval) {
      clearInterval(this.offlineInterval);
    }
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    await this.sendFleetSnapshot(client);
    await this.sendEventsHistory(client);
  }

  emitGpsUpdate(payload: GpsUpdatePayload) {
    this.server.emit('gps:update', payload);
  }

  emitEventNew(payload: EventNewPayload) {
    this.server.emit('event:new', payload);
  }

  emitVehicleStatus(payload: VehicleStatusPayload) {
    this.server.emit('vehicle:status', payload);
  }

  private async sendFleetSnapshot(client: Socket) {
    const states = await this.redisService.getAllVehicleStates();
    if (states.length === 0) {
      client.emit('fleet:snapshot', []);
      return;
    }

    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        deviceId: {
          in: states.map((item) => item.deviceId),
        },
      },
      select: {
        id: true,
        deviceId: true,
        driverName: true,
        licensePlate: true,
      },
    });

    const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.deviceId, vehicle]));

    const snapshot = states
      .map(({ deviceId, state }) => {
        const vehicle = vehicleMap.get(deviceId);
        if (!vehicle) {
          return null;
        }

        return {
          vehicleId: vehicle.id,
          deviceId: vehicle.deviceId,
          driverName: vehicle.driverName,
          licensePlate: vehicle.licensePlate,
          ...state,
        };
      })
      .filter(Boolean);

    client.emit('fleet:snapshot', snapshot);
  }

  private async sendEventsHistory(client: Socket) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        timestamp: {
          gte: oneHourAgo,
        },
      },
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
      orderBy: {
        timestamp: 'desc',
      },
      take: 500,
    });

    client.emit(
      'events:history',
      events.map((event) => ({
        id: event.id,
        vehicleId: event.vehicleId,
        deviceId: event.vehicle.deviceId,
        driverName: event.vehicle.driverName,
        licensePlate: event.vehicle.licensePlate,
        type: event.type,
        severity: event.severity,
        lat: event.lat,
        lng: event.lng,
        timestamp: event.timestamp.toISOString(),
        groupCount: event.groupCount,
      })),
    );
  }

  private async emitOfflineStatuses() {
    const staleVehicles = await this.vehiclesService.markStaleOffline(15);

    staleVehicles.forEach((vehicle) => {
      this.emitVehicleStatus({
        vehicleId: vehicle.id,
        isOnline: false,
      });
    });
  }
}
