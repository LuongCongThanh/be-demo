import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { OptionType } from '../../generated/prisma/enums.js';

export const OPTION_VALUE_CODE_PATTERN = /^[A-Z0-9]{1,10}$/;

export class CreateOptionValueDto {
  @ApiProperty({ enum: OptionType, example: OptionType.COLOR })
  @IsEnum(OptionType)
  type: OptionType;

  @ApiProperty({ maxLength: 50, example: 'Đen' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  name: string;

  // Không tự viết hoa — FE phải thấy đúng giá trị sẽ nằm trong SKU.
  @ApiProperty({
    pattern: OPTION_VALUE_CODE_PATTERN.source,
    description: 'Ghép vào SKU — không đổi được sau khi tạo',
    example: 'BLK',
  })
  @IsString()
  @Matches(OPTION_VALUE_CODE_PATTERN, { message: 'code must be 1-10 uppercase letters or digits' })
  code: string;

  @ApiPropertyOptional({
    minimum: 0,
    example: 2,
    description: 'Thứ tự hiển thị — bỏ trống = cuối danh sách của loại đó',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
