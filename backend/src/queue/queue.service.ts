import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, ConsumeMessage, connect } from 'amqplib';
import { RedisService } from '../cache/redis.service';
import { FleetGateway } from '../gateway/fleet.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import {
  EVENT_ROUTING_KEY,
  EVENTS_QUEUE,
  GPS_QUEUE,
  GPS_ROUTING_KEY,
  QUEUE_EXCHANGE,
  WEBHOOK_QUEUE,
  WEBHOOK_ROUTING_KEY,
} from './queue.constants';
import { FleetEventMessage, GpsMessage } from './queue.types';

@Injectable()
export class QueueService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly vehiclesService: VehiclesService,
    private readonly fleetGateway: FleetGateway,
  ) {}

  async onApplicationBootstrap() {
    await this.setupConnection();
    await this.startConsumers();
  }

  async onModuleDestroy() {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }

  getChannel() {
    return this.channel;
  }

  async publishToWebhookQueue(payload: Record<string, unknown>) {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const ok = this.channel.publish(
      QUEUE_EXCHANGE,
      WEBHOOK_ROUTING_KEY,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true },
    );

    if (!ok) {
      this.logger.warn('Failed to publish message to webhook queue');
    }
  }

  private async setupConnection() {
    const rabbitUrl =
      this.configService.get<string>('RABBITMQ_URL') ||
      'amqp://guest:guest@localhost:5672';

    const connection = await connect(rabbitUrl);
    const channel = await connection.createChannel();

    this.connection = connection;
    this.channel = channel;

    await channel.assertExchange(QUEUE_EXCHANGE, 'topic', { durable: true });
    await channel.assertQueue(GPS_QUEUE, { durable: true });
    await channel.assertQueue(EVENTS_QUEUE, { durable: true });
    await channel.assertQueue(WEBHOOK_QUEUE, { durable: true });

    await channel.bindQueue(GPS_QUEUE, QUEUE_EXCHANGE, GPS_ROUTING_KEY);
    await channel.bindQueue(EVENTS_QUEUE, QUEUE_EXCHANGE, EVENT_ROUTING_KEY);
    await channel.bindQueue(WEBHOOK_QUEUE, QUEUE_EXCHANGE, WEBHOOK_ROUTING_KEY);

    channel.prefetch(50);
    this.logger.log('RabbitMQ exchange and queues are initialized');
  }

  private async startConsumers() {
    const channel = this.channel;
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    await channel.consume(GPS_QUEUE, async (message) => {
      await this.consumeGpsMessage(message);
    });

    await channel.consume(EVENTS_QUEUE, async (message) => {
      await this.consumeEventMessage(message);
    });

    this.logger.log('RabbitMQ consumers for gps and events started');
  }

  private async consumeGpsMessage(message: ConsumeMessage | null) {
    const channel = this.channel;
    if (!message || !channel) {
      return;
    }

    try {
      const payload = JSON.parse(message.content.toString()) as GpsMessage;
      const timestamp = new Date(payload.timestamp);

      const vehicle = await this.vehiclesService.getOrCreateByDeviceId(payload.device_id);

      await this.prisma.gpsPoint.create({
        data: {
          vehicleId: vehicle.id,
          lat: payload.lat,
          lng: payload.lng,
          speed: payload.speed,
          heading: payload.heading,
          timestamp,
        },
      });

      await this.vehiclesService.touchOnline(vehicle.id, timestamp);

      await this.redisService.setVehicleState(payload.device_id, {
        lat: payload.lat,
        lng: payload.lng,
        speed: payload.speed,
        heading: payload.heading,
        timestamp: timestamp.toISOString(),
      });

      this.fleetGateway.emitGpsUpdate({
        vehicleId: vehicle.id,
        lat: payload.lat,
        lng: payload.lng,
        speed: payload.speed,
        heading: payload.heading,
        timestamp: timestamp.toISOString(),
      });
      this.fleetGateway.emitVehicleStatus({
        vehicleId: vehicle.id,
        isOnline: true,
      });

      channel.ack(message);
    } catch (error) {
      this.logger.error(`Failed to process GPS message: ${(error as Error).message}`);
      channel.nack(message, false, false);
    }
  }

  private async consumeEventMessage(message: ConsumeMessage | null) {
    const channel = this.channel;
    if (!message || !channel) {
      return;
    }

    try {
      const payload = JSON.parse(message.content.toString()) as FleetEventMessage;
      const timestamp = new Date(payload.timestamp);

      const vehicle = await this.vehiclesService.getOrCreateByDeviceId(payload.device_id);
      const dedupEventId = await this.redisService.getEventDedupEventId(
        vehicle.id,
        payload.type,
      );

      if (dedupEventId) {
        const groupedEvent = await this.prisma.event.update({
          where: { id: dedupEventId },
          data: {
            grouped: true,
            groupCount: {
              increment: 1,
            },
          },
        });

        await this.vehiclesService.touchOnline(vehicle.id, timestamp);
        this.fleetGateway.emitEventNew({
          id: groupedEvent.id,
          vehicleId: groupedEvent.vehicleId,
          type: groupedEvent.type,
          severity: groupedEvent.severity,
          lat: groupedEvent.lat,
          lng: groupedEvent.lng,
          timestamp: groupedEvent.timestamp.toISOString(),
          groupCount: groupedEvent.groupCount,
        });
        this.fleetGateway.emitVehicleStatus({
          vehicleId: vehicle.id,
          isOnline: true,
        });
        channel.ack(message);
        return;
      }

      const event = await this.prisma.event.create({
        data: {
          vehicleId: vehicle.id,
          type: payload.type as any,
          severity: payload.severity as any,
          lat: payload.lat,
          lng: payload.lng,
          timestamp,
        },
      });

      await this.redisService.setEventDedupKey(vehicle.id, payload.type, event.id);
      await this.vehiclesService.touchOnline(vehicle.id, timestamp);
      this.fleetGateway.emitEventNew({
        id: event.id,
        vehicleId: event.vehicleId,
        type: event.type,
        severity: event.severity,
        lat: event.lat,
        lng: event.lng,
        timestamp: event.timestamp.toISOString(),
        groupCount: event.groupCount,
      });
      this.fleetGateway.emitVehicleStatus({
        vehicleId: vehicle.id,
        isOnline: true,
      });

      if (event.severity === 'CRITICAL') {
        this.logger.warn(
          `Critical event detected: eventId=${event.id} vehicleId=${event.vehicleId} type=${event.type}`,
        );
        await this.publishToWebhookQueue({ eventId: event.id });
      }

      channel.ack(message);
    } catch (error) {
      this.logger.error(`Failed to process fleet event: ${(error as Error).message}`);
      channel.nack(message, false, false);
    }
  }
}
