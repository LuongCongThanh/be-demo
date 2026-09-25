import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { QueryFlag } from '../../../common/query-flag.js';
import { OptionType } from '../../../generated/prisma/enums.js';

export class ListOptionValuesQueryDto {
  @ApiPropertyOptional({ enum: OptionType, example: OptionType.SIZE })
  @IsOptional()
  @IsEnum(OptionType)
  type?: OptionType;

  @ApiPropertyOptional({ description: 'Kèm cả giá trị đang ẩn — chỉ STORE_MANAGER/MASTER_ADMIN', example: true })
  @QueryFlag('includeHidden')
  includeHidden?: boolean;
}
