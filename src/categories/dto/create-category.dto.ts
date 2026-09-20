import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 150 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name: string;

  // No `slug` field — the server derives it from `name` (see CategoriesService,
  // Task 2). A client-sent `slug` is rejected with 400 by the global
  // ValidationPipe (`forbidNonWhitelisted: true`), not silently dropped.

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
