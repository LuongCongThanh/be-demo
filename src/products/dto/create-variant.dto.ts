import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateVariantDto {
  @ApiProperty({
    maxLength: 100,
    description: 'Client tự đặt theo quy ước riêng của store — không tự sinh',
    example: 'TSHIRT-BLK-M',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  sku: string;

  @ApiPropertyOptional({ maxLength: 50, example: 'Black' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ maxLength: 50, example: 'M' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string;

  @ApiProperty({ example: 199000 })
  @IsNotEmpty()
  // Map tới cột Decimal(12,2) — chặn client gửi quá 2 số thập phân thay vì
  // để Postgres tự làm tròn âm thầm.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  // Không có field `productId` — lấy từ path param `:id` (Task 9), không từ body.
}
