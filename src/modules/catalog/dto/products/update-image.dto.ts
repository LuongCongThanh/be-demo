import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateImageDto } from '#src/modules/catalog/dto/products/create-image.dto.js';

/** Đổi màu của ảnh = xoá rồi thêm lại; ở đây chỉ sửa key, alt, thứ tự, cờ primary. */
export class UpdateImageDto extends PartialType(OmitType(CreateImageDto, ['colorId'] as const)) {}
