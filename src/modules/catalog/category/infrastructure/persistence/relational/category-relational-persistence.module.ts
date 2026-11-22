import { Module } from '@nestjs/common';
import { PrismaCategoryRepository } from '#src/modules/catalog/category/infrastructure/persistence/relational/adapters/prisma-category.repository.js';

@Module({
  providers: [PrismaCategoryRepository],
  exports: [PrismaCategoryRepository],
})
export class CategoryRelationalPersistenceModule {}
