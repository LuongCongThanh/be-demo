import { Module } from '@nestjs/common';
import { PrismaModule } from '#src/infrastructure/database/prisma.module.js';
import { IdentityModule } from '#src/modules/identity/identity.module.js';
import { InventoryController } from '#src/modules/inventory/inventory.controller.js';
import { InventoryService } from '#src/modules/inventory/inventory.service.js';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
