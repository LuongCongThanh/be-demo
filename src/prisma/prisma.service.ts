import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Dùng thẳng tham số `config` (chưa phải `this.config`) vì `this` chưa dùng
  // được trước khi gọi `super()` — tham số constructor thì dùng được.
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({ connectionString: config.get<string>('DATABASE_URL') }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
