import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 150, example: "Men's Clothing" })
  // Trim trước khi validate — tên chỉ gồm khoảng trắng phải bị @IsNotEmpty()
  // từ chối thay vì lọt qua rồi sinh slug rỗng (xem toSlug() trong service).
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name: string;

  // Không có field `slug` — server tự sinh từ `name` (xem CategoriesService).
  // Client gửi `slug` lên sẽ bị ValidationPipe global từ chối với 400
  // (`forbidNonWhitelisted: true`), không bị âm thầm bỏ qua.

  @ApiPropertyOptional({ example: 'Apparel and accessories for men' })
  @IsOptional()
  @IsString()
  description?: string;
}
