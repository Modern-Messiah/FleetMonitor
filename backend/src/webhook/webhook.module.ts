import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { WebhookWorkerService } from './webhook-worker.service';

@Module({
  imports: [QueueModule],
  providers: [WebhookWorkerService],
})
export class WebhookModule {}
