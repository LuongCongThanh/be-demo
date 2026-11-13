import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsDate, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Đặt Giá khuyến mãi cho một hoặc nhiều Biến thể của cùng Sản phẩm (US-804). Gửi đúng một trong
 * `price` (số tiền chung) hoặc `percentOff` (tính riêng từng Biến thể, làm tròn xuống đến đồng).
 * Cả lô thành công hoặc thất bại cùng nhau.
 */
export class CreateSalePriceDto {
  @ApiProperty({
    type: [String],
    description: 'Variants of this product',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  variantIds: string[];

  @ApiPropertyOptional({
    description: 'Integer VND for every listed Variant; must be below each Variant price',
    example: 159000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  price?: number;

  @ApiPropertyOptional({ description: 'Percent off each Variant price (1–99), rounded down to the đồng', example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  percentOff?: number;

  @ApiPropertyOptional({ format: 'date-time', description: 'Defaults to now; may not be in the past' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @ApiProperty({ format: 'date-time', description: 'Exclusive end, after startsAt' })
  @Type(() => Date)
  @IsDate()
  endsAt: Date;
}
