import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from './cache/cache.module';
import { EventsModule } from './events/events.module';
import { GatewayModule } from './gateway/gateway.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CacheModule,
    VehiclesModule,
    EventsModule,
    GatewayModule,
    QueueModule,
    WebhookModule,
    HealthModule,
  ],
})
export class AppModule {}
