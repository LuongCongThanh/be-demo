import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '#src/common/pagination/pagination.dto.js';
import { VOUCHER_STATUSES, type VoucherStatus } from '#src/modules/voucher/voucher-status.js';

export class ListVouchersQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Part of the code, case-insensitive', example: 'SALE' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(32)
  q?: string;

  @ApiPropertyOptional({ enum: VOUCHER_STATUSES, enumName: 'VoucherStatus' })
  @IsOptional()
  @IsIn(VOUCHER_STATUSES)
  status?: VoucherStatus;
}
