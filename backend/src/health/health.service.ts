import { Injectable } from '@nestjs/common';
import { RedisService } from '../cache/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
  ) {}

  async check() {
    const postgres = await this.checkPostgres();
    const redis = await this.checkRedis();
    const rabbitmq = await this.checkRabbitmq();

    return {
      status:
        postgres === 'ok' && redis === 'ok' && rabbitmq === 'ok'
          ? 'ok'
          : 'degraded',
      postgres,
      redis,
      rabbitmq,
    };
  }

  private async checkPostgres() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'failed';
    }
  }

  private async checkRedis() {
    try {
      await this.redisService.getClient().ping();
      return 'ok';
    } catch {
      return 'failed';
    }
  }

  private async checkRabbitmq() {
    try {
      const channel = this.queueService.getChannel();
      if (!channel) {
        return 'failed';
      }
      await channel.checkQueue('gps.updates');
      return 'ok';
    } catch {
      return 'failed';
    }
  }
}
