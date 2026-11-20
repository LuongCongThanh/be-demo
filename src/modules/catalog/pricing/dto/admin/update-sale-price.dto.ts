import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Sắp diễn ra: đổi được cả ba. Đang hiệu lực: chỉ `endsAt`. Đã kết thúc: không đổi được. */
export class UpdateSalePriceDto {
  @ApiPropertyOptional({ description: 'Integer VND, below the Variant price (upcoming only)', example: 149000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  price?: number;

  @ApiPropertyOptional({ format: 'date-time', description: 'Upcoming only; may not be in the past' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @ApiPropertyOptional({ format: 'date-time', description: 'Exclusive end; not in the past' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;
}
