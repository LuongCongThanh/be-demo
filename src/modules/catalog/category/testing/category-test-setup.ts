import type { Provider } from '@nestjs/common';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import {
  CATEGORY_LANGUAGE_REPOSITORY,
  CATEGORY_REPOSITORY,
  CATEGORY_TRANSLATION_REPOSITORY,
} from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import { PrismaCategoryRepository } from '#src/modules/catalog/category/infrastructure/persistence/relational/adapters/prisma-category.repository.js';

export function categoryRepositoryProviders(prismaMock: unknown): Provider[] {
  return [
    PrismaCategoryRepository,
    { provide: CATEGORY_REPOSITORY, useExisting: PrismaCategoryRepository },
    { provide: CATEGORY_TRANSLATION_REPOSITORY, useExisting: PrismaCategoryRepository },
    { provide: CATEGORY_LANGUAGE_REPOSITORY, useExisting: PrismaCategoryRepository },
    { provide: PrismaService, useValue: prismaMock },
  ];
}
