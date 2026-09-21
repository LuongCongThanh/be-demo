import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ maxLength: 255, example: 'Wireless Headphones' })
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
