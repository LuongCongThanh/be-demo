import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateSizeDto } from '#src/modules/catalog/dto/product-options/create-size.dto.js';

/** `code` không đổi được: storefront và filter tham chiếu theo mã. */
export class UpdateSizeDto extends PartialType(OmitType(CreateSizeDto, ['code'] as const)) {}
