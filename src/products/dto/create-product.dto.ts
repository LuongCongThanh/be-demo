import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

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

  // Không có field `slug` — server tự sinh từ `name` (Task 3). Không có
  // field `status` — mặc định ACTIVE ở DB, chỉ đổi được qua UpdateProductDto.
}
