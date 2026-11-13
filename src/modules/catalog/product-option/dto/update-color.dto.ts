import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateColorDto } from '#src/modules/catalog/product-option/dto/create-color.dto.js';

/** `code` không đổi được: storefront và filter tham chiếu theo mã. */
export class UpdateColorDto extends PartialType(OmitType(CreateColorDto, ['code'] as const)) {}
