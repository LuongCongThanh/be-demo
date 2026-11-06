import { Module } from '@nestjs/common';
import { AuthModule } from '#src/auth/auth.module.js';
import { CategoriesController } from '#src/categories/categories.controller.js';
import { CategoriesService } from '#src/categories/categories.service.js';
import { AdminCategoriesController } from '#src/categories/admin-categories.controller.js';
import { AdminCategoriesService } from '#src/categories/admin-categories.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService, AdminCategoriesService],
})
export class CategoriesModule {}
