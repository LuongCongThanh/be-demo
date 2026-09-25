import { ApiPropertyOptional } from '@nestjs/swagger';
import { QueryFlag } from '../../../common/query-flag.js';

// Mặc định read public chỉ trả variant ACTIVE. Form edit của staff bắt buộc
// bật cờ này: PATCH full-sync với danh sách thiếu sẽ discontinue các variant
// bị bỏ sót. Quyền kiểm ở StaffQueryFlagGuard('includeAllVariants').
export class VariantVisibilityQueryDto {
  @ApiPropertyOptional({
    description: 'Trả mọi variant (kể cả INACTIVE/DISCONTINUED) — chỉ STORE_MANAGER/MASTER_ADMIN',
    example: true,
  })
  @QueryFlag('includeAllVariants')
  includeAllVariants?: boolean;
}
