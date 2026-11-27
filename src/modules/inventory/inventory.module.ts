import { Module } from '@nestjs/common';
import { IdentityModule } from '#src/modules/identity/identity.module.js';
import { AdminInventoryService } from '#src/modules/inventory/application/admin-inventory.service.js';
import { InventoryService } from '#src/modules/inventory/application/inventory.service.js';
import { InventoryRepository } from '#src/modules/inventory/application/ports/inventory.repository.js';
import { InventoryController } from '#src/modules/inventory/admin/controllers/inventory.controller.js';
import { PrismaInventoryRepository } from '#src/modules/inventory/infrastructure/prisma-inventory.repository.js';

@Module({
  imports: [IdentityModule],
  controllers: [InventoryController],
  providers: [
    AdminInventoryService,
    InventoryService,
    PrismaInventoryRepository,
    { provide: InventoryRepository, useExisting: PrismaInventoryRepository },
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
