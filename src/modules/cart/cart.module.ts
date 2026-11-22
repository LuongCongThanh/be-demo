import { Module } from '@nestjs/common';
import { PrismaModule } from '#src/infrastructure/database/prisma.module.js';
import { IdentityModule } from '#src/modules/identity/identity.module.js';
import { CartController } from '#src/modules/cart/cart.controller.js';
import { CartService } from '#src/modules/cart/cart.service.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
