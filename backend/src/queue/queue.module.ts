import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { GatewayModule } from '../gateway/gateway.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { QueueService } from './queue.service';

@Module({
  imports: [CacheModule, VehiclesModule, GatewayModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
