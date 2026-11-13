import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateVoucherDto } from '#src/modules/voucher/dto/create-voucher.dto.js';

/**
 * Mã không đổi. Chưa ai dùng: sửa mọi trường còn lại. Đã có lượt dùng: chỉ `endsAt`, `totalLimit`
 * (không dưới số đã dùng), `perBuyerLimit`, `isActive` — kiểm ở service.
 */
export class UpdateVoucherDto extends PartialType(OmitType(CreateVoucherDto, ['code'] as const)) {}
