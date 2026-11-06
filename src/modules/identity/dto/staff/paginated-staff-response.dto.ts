import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '#src/common/pagination/pagination-meta.dto.js';
import { StaffResponseDto } from '#src/modules/identity/dto/staff/staff-response.dto.js';

export class PaginatedStaffResponseDto {
  @ApiProperty({ type: [StaffResponseDto] })
  data: StaffResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
