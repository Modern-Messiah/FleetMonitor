import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventType, Severity } from '@prisma/client';
import { Channel, Connection, ConsumeMessage, connect } from 'amqplib';
import { RedisService } from '../cache/redis.service';
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
  private connection?: Connection;
  private channel?: Channel;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async onApplicationBootstrap() {
    await this.setupConnection();
    await this.startConsumers();
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
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

    this.connection = await connect(rabbitUrl);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(QUEUE_EXCHANGE, 'topic', { durable: true });
    await this.channel.assertQueue(GPS_QUEUE, { durable: true });
    await this.channel.assertQueue(EVENTS_QUEUE, { durable: true });
    await this.channel.assertQueue(WEBHOOK_QUEUE, { durable: true });

    await this.channel.bindQueue(GPS_QUEUE, QUEUE_EXCHANGE, GPS_ROUTING_KEY);
    await this.channel.bindQueue(EVENTS_QUEUE, QUEUE_EXCHANGE, EVENT_ROUTING_KEY);
    await this.channel.bindQueue(WEBHOOK_QUEUE, QUEUE_EXCHANGE, WEBHOOK_ROUTING_KEY);

    this.channel.prefetch(50);
    this.logger.log('RabbitMQ exchange and queues are initialized');
  }

  private async startConsumers() {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    await this.channel.consume(GPS_QUEUE, async (message) => {
      await this.consumeGpsMessage(message);
    });

    await this.channel.consume(EVENTS_QUEUE, async (message) => {
      await this.consumeEventMessage(message);
    });

    this.logger.log('RabbitMQ consumers for gps and events started');
  }

  private async consumeGpsMessage(message: ConsumeMessage | null) {
    if (!message || !this.channel) {
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

      this.channel.ack(message);
    } catch (error) {
      this.logger.error(`Failed to process GPS message: ${(error as Error).message}`);
      this.channel.nack(message, false, false);
    }
  }

  private async consumeEventMessage(message: ConsumeMessage | null) {
    if (!message || !this.channel) {
      return;
    }

    try {
      const payload = JSON.parse(message.content.toString()) as FleetEventMessage;
      const timestamp = new Date(payload.timestamp);

      const vehicle = await this.vehiclesService.getOrCreateByDeviceId(payload.device_id);

      const event = await this.prisma.event.create({
        data: {
          vehicleId: vehicle.id,
          type: payload.type as EventType,
          severity: payload.severity as Severity,
          lat: payload.lat,
          lng: payload.lng,
          timestamp,
        },
      });

      await this.vehiclesService.touchOnline(vehicle.id, timestamp);

      if (event.severity === 'CRITICAL') {
        await this.publishToWebhookQueue({ eventId: event.id });
      }

      this.channel.ack(message);
    } catch (error) {
      this.logger.error(`Failed to process fleet event: ${(error as Error).message}`);
      this.channel.nack(message, false, false);
    }
  }
}
