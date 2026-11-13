import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 150, example: "Men's Clothing" })
  // Trim trước khi validate — tên chỉ gồm khoảng trắng phải bị @IsNotEmpty()
  // từ chối thay vì lọt qua rồi sinh slug rỗng (xem toSlug() trong service).
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name: string;

  // Không có field `slug` — server tự sinh từ `name` (xem CategoryService).
  // Client gửi `slug` lên sẽ bị ValidationPipe global từ chối với 400
  // (`forbidNonWhitelisted: true`), không bị âm thầm bỏ qua.

  @ApiPropertyOptional({ example: 'Apparel and accessories for men' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Parent category; omit or null for a root category',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  // null hợp lệ (= gốc), nên chỉ validate khi có giá trị.
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ default: 0, minimum: 0, description: 'Ascending order among siblings', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Hidden categories (and their subtree) leave the storefront',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
