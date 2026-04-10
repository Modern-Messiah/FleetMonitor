import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsumeMessage } from 'amqplib';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_EXCHANGE, WEBHOOK_QUEUE, WEBHOOK_ROUTING_KEY } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';

interface WebhookMessage {
  eventId: string;
}

@Injectable()
export class WebhookWorkerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WebhookWorkerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async onApplicationBootstrap() {
    await this.startConsumerWithRetry();
  }

  private async startConsumerWithRetry(retry = 0): Promise<void> {
    const channel = this.queueService.getChannel();

    if (!channel) {
      const delay = Math.min(1000 * (retry + 1), 5000);
      this.logger.warn(`Webhook consumer waits for queue channel (${delay}ms)`);
      await this.sleep(delay);
      return this.startConsumerWithRetry(retry + 1);
    }

    await channel.assertExchange(QUEUE_EXCHANGE, 'topic', { durable: true });
    await channel.assertQueue(WEBHOOK_QUEUE, { durable: true });
    await channel.bindQueue(WEBHOOK_QUEUE, QUEUE_EXCHANGE, WEBHOOK_ROUTING_KEY);

    await channel.consume(WEBHOOK_QUEUE, async (message) => {
      await this.consume(message);
    });

    this.logger.log('Webhook consumer started');
  }

  private async consume(message: ConsumeMessage | null) {
    const channel = this.queueService.getChannel();
    if (!message || !channel) {
      return;
    }

    try {
      const payload = JSON.parse(message.content.toString()) as WebhookMessage;
      const event = await this.prisma.event.findUnique({
        where: { id: payload.eventId },
      });

      if (!event) {
        this.logger.warn(`Webhook event not found: ${payload.eventId}`);
        channel.ack(message);
        return;
      }

      await this.processWebhook(event.id, {
        eventId: event.id,
        vehicleId: event.vehicleId,
        type: event.type,
        severity: event.severity,
        lat: event.lat,
        lng: event.lng,
        timestamp: event.timestamp.toISOString(),
        groupCount: event.groupCount,
      });

      channel.ack(message);
    } catch (error) {
      this.logger.error(`Webhook worker failed: ${(error as Error).message}`);
      channel.nack(message, false, false);
    }
  }

  private async processWebhook(eventId: string, body: Record<string, unknown>) {
    const url = this.configService.get<string>('WEBHOOK_URL');

    if (!url) {
      this.logger.warn('WEBHOOK_URL is not configured, skipping webhook delivery');
      await this.prisma.webhookLog.upsert({
        where: { eventId },
        create: {
          eventId,
          url: 'not-configured',
          status: 'FAILED' as any,
          attempts: 0,
          response: 'WEBHOOK_URL is not configured',
          lastAttemptAt: new Date(),
        },
        update: {
          url: 'not-configured',
          status: 'FAILED' as any,
          response: 'WEBHOOK_URL is not configured',
          lastAttemptAt: new Date(),
        },
      });
      return;
    }

    const delays = [1000, 2000, 4000];

    await this.prisma.webhookLog.upsert({
      where: { eventId },
      create: {
        eventId,
        url,
        status: 'PENDING' as any,
        attempts: 0,
      },
      update: {
        url,
      },
    });

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const now = new Date();
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const responseText = (await response.text()).slice(0, 4000);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${responseText}`);
        }

        await this.prisma.webhookLog.update({
          where: { eventId },
          data: {
            status: 'SUCCESS' as any,
            attempts: attempt,
            lastAttemptAt: now,
            response: responseText || `HTTP ${response.status}`,
          },
        });

        this.logger.log(`Webhook sent successfully for event ${eventId}`);
        return;
      } catch (error) {
        const message = (error as Error).message;

        await this.prisma.webhookLog.update({
          where: { eventId },
          data: {
            status: (attempt >= 3 ? 'FAILED' : 'PENDING') as any,
            attempts: attempt,
            lastAttemptAt: now,
            response: message,
          },
        });

        this.logger.warn(
          `Webhook attempt ${attempt}/3 failed for event ${eventId}: ${message}`,
        );

        if (attempt < 3) {
          await this.sleep(delays[attempt - 1]);
        }
      }
    }
  }

  private async sleep(ms: number) {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
