import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '#src/common/pagination/pagination-meta.dto.js';
import { VoucherResponseDto } from '#src/modules/voucher/dto/voucher-response.dto.js';

export class PaginatedVoucherResponseDto {
  @ApiProperty({ type: [VoucherResponseDto] })
  data: VoucherResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
