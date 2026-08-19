import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('redisHost', 'localhost'),
      port: this.configService.get<number>('redisPort', 6379),
      password: this.configService.get<string>('redisPassword') || undefined,
    });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string): Promise<string> {
    return this.client.set(key, value);
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    return this.client.setex(key, seconds, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }
}
