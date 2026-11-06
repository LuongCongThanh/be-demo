import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ maxLength: 255, example: 'Wireless Headphones' })
  // Trim trước khi validate — tên chỉ gồm khoảng trắng phải bị @IsNotEmpty()
  // từ chối thay vì lọt qua rồi sinh slug rỗng (xem toSlug() trong service).
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'UUID của Category đã tồn tại',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({ minimum: 1, description: 'Shipping weight in grams (BR-CAT-06)', example: 250 })
  @IsInt()
  @Min(1)
  weightGrams: number;

  // Không có field `slug` — server tự sinh từ `name`. Không có field `status` —
  // sản phẩm mới luôn là DRAFT (BR-CAT-07), chỉ đổi được qua UpdateProductDto.
}
