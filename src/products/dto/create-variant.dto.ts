import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateVariantDto {
  @ApiProperty({ maxLength: 100, description: 'Client tự đặt theo quy ước riêng của store — không tự sinh' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  sku: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  // Không có field `productId` — lấy từ path param `:id` (Task 9), không từ body.
}
