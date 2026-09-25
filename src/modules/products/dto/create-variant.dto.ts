import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

// Không có `sku`/`color`/`size` tự do — staff chọn Option Value, hệ thống
// ghép SKU từ Product Code + mã màu/size (docs/adr/0011). Không có `productId`
// — lấy từ product đang tạo/sửa.
export class CreateVariantDto {
  @ApiPropertyOptional({ description: 'Option Value loại COLOR', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  colorId?: string;

  @ApiPropertyOptional({ description: 'Option Value loại SIZE', example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' })
  @IsOptional()
  @IsUUID()
  sizeId?: string;

  @ApiProperty({ example: 199000 })
  @IsNotEmpty()
  // Map tới cột Decimal(12,2) — chặn client gửi quá 2 số thập phân thay vì
  // để Postgres tự làm tròn âm thầm.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;
}
