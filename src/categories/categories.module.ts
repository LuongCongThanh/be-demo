import { Module } from '@nestjs/common';
import { AuthModule } from '#src/auth/auth.module.js';
import { CategoriesController } from '#src/categories/categories.controller.js';
import { CategoriesService } from '#src/categories/categories.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
