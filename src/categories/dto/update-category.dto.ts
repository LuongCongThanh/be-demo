import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto.js';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  // Override `name` thay vì để nguyên field @IsOptional() PartialType tự sinh:
  // @IsOptional() coi `null` như "absent" và bỏ qua mọi validator phía sau —
  // client gửi { "name": null } sẽ lọt qua validation, rồi Prisma từ chối
  // `null` cho cột NOT NULL bằng PrismaClientValidationError (không phải
  // PrismaClientKnownRequestError nên AllExceptionsFilter không map được,
  // rơi xuống 500 thay vì 400). @ValidateIf chỉ skip khi field thật sự vắng
  // mặt (undefined), còn `null` vẫn phải qua @IsString/@IsNotEmpty như bình
  // thường và bị từ chối 400 ở đây.
  @ApiPropertyOptional({ maxLength: 150, example: "Men's Clothing" })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  declare name?: string;
}
