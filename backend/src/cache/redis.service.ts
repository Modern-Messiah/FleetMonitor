import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface VehicleState {
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  timestamp: string;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.client = new Redis(redisUrl);
    this.client.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
    await this.client.ping();
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  async setVehicleState(deviceId: string, state: VehicleState) {
    await this.client.set(this.getVehicleStateKey(deviceId), JSON.stringify(state), 'EX', 30);
  }

  async getVehicleState(deviceId: string) {
    const data = await this.client.get(this.getVehicleStateKey(deviceId));
    return data ? (JSON.parse(data) as VehicleState) : null;
  }

  async listVehicleStateKeys() {
    return this.client.keys('vehicle:*:state');
  }

  async getAllVehicleStates() {
    const keys = await this.listVehicleStateKeys();
    if (keys.length === 0) {
      return [] as Array<{ deviceId: string; state: VehicleState }>;
    }

    const values = await this.client.mget(keys);
    return keys
      .map((key, index) => {
        const value = values[index];
        if (!value) {
          return null;
        }
        const deviceId = key.split(':')[1];
        return {
          deviceId,
          state: JSON.parse(value) as VehicleState,
        };
      })
      .filter(Boolean) as Array<{ deviceId: string; state: VehicleState }>;
  }

  getClient() {
    return this.client;
  }

  private getVehicleStateKey(deviceId: string) {
    return `vehicle:${deviceId}:state`;
  }
}
