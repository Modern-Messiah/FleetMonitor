import { Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { QueueService } from './queue.service';

@Module({
  imports: [CacheModule, VehiclesModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
