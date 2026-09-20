import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 150 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name: string;

  // Không có field `slug` — server tự sinh từ `name` (xem CategoriesService).
  // Client gửi `slug` lên sẽ bị ValidationPipe global từ chối với 400
  // (`forbidNonWhitelisted: true`), không bị âm thầm bỏ qua.

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
