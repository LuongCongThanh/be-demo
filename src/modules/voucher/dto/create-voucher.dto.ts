import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsOptional, Matches, Max, Min, ValidateIf } from 'class-validator';
import { VoucherType } from '#src/generated/prisma/enums.js';

/** Voucher mới (US-901 AC1). Kiểm chéo (% ≤ 100, mức tối đa chỉ cho %, thời gian) ở service. */
export class CreateVoucherDto {
  @ApiProperty({ example: 'sale10', description: '3–32 letters, digits, - or _; stored upper case (BR-VCH-09)' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9_-]{3,32}$/, { message: 'code must be 3–32 letters, digits, - or _' })
  code: string;

  @ApiProperty({ enum: VoucherType, enumName: 'VoucherType' })
  @IsEnum(VoucherType)
  type: VoucherType;

  @ApiProperty({ description: 'PERCENT: 1–100; FIXED: integer VND > 0', example: 10 })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  value: number;

  @ApiPropertyOptional({ nullable: true, type: Number, description: 'PERCENT only; cap in VND', example: 50000 })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  maxDiscount?: number | null;

  @ApiPropertyOptional({ description: 'Minimum Subtotal in VND', default: 0, example: 300000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  minSubtotal?: number;

  @ApiPropertyOptional({ nullable: true, type: Number, description: 'null = unlimited', example: 100 })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  totalLimit?: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number, description: 'null = unlimited', example: 1 })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  perBuyerLimit?: number | null;

  @ApiProperty({ format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  startsAt: Date;

  @ApiProperty({ format: 'date-time', description: 'Exclusive end, after startsAt' })
  @Type(() => Date)
  @IsDate()
  endsAt: Date;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
