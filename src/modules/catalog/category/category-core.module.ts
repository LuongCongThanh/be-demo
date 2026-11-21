import { Module } from '@nestjs/common';
import { StorageModule } from '#src/infrastructure/storage/storage.module.js';
import {
  CATEGORY_LANGUAGE_REPOSITORY,
  CATEGORY_REPOSITORY,
  CATEGORY_TRANSLATION_REPOSITORY,
} from '#src/modules/catalog/category/application/ports/persistence/category.repository.js';
import { CATEGORY_IMAGE_STORAGE } from '#src/modules/catalog/category/application/ports/storage/category-image.storage.js';
import { CATEGORY_TRANSLATION_PORT } from '#src/modules/catalog/category/application/ports/translation/category-translation.port.js';
import { CATEGORY_TRANSLATION_WORKER_PORT } from '#src/modules/catalog/category/application/ports/translation/category-translation-worker.port.js';
import { CategoryLanguageService } from '#src/modules/catalog/category/application/shared/localization/category-language.service.js';
import { CategoryTranslationService } from '#src/modules/catalog/category/application/shared/translation/category-translation.service.js';
import { CategoryRelationalPersistenceModule } from '#src/modules/catalog/category/infrastructure/persistence/relational/category-relational-persistence.module.js';
import { PrismaCategoryRepository } from '#src/modules/catalog/category/infrastructure/persistence/relational/adapters/prisma-category.repository.js';
import { CategoryTranslationClient } from '#src/modules/catalog/category/infrastructure/integrations/translation/category-translation.client.js';
import { CloudinaryCategoryImageStorage } from '#src/modules/catalog/category/infrastructure/storage/cloudinary-category-image.storage.js';
import { CategoryErrorMappingInterceptor } from '#src/modules/catalog/category/presentation/category-error-mapping.interceptor.js';

@Module({
  imports: [StorageModule, CategoryRelationalPersistenceModule],
  providers: [
    CategoryLanguageService,
    CategoryTranslationService,
    CategoryErrorMappingInterceptor,
    CategoryTranslationClient,
    CloudinaryCategoryImageStorage,
    { provide: CATEGORY_REPOSITORY, useExisting: PrismaCategoryRepository },
    { provide: CATEGORY_TRANSLATION_REPOSITORY, useExisting: PrismaCategoryRepository },
    { provide: CATEGORY_LANGUAGE_REPOSITORY, useExisting: PrismaCategoryRepository },
    { provide: CATEGORY_TRANSLATION_WORKER_PORT, useExisting: PrismaCategoryRepository },
    { provide: CATEGORY_TRANSLATION_PORT, useExisting: CategoryTranslationClient },
    { provide: CATEGORY_IMAGE_STORAGE, useExisting: CloudinaryCategoryImageStorage },
  ],
  exports: [
    CATEGORY_REPOSITORY,
    CATEGORY_TRANSLATION_REPOSITORY,
    CATEGORY_LANGUAGE_REPOSITORY,
    CATEGORY_TRANSLATION_WORKER_PORT,
    CATEGORY_TRANSLATION_PORT,
    CATEGORY_IMAGE_STORAGE,
    CategoryLanguageService,
    CategoryTranslationService,
    CategoryErrorMappingInterceptor,
  ],
})
export class CategoryCoreModule {}
