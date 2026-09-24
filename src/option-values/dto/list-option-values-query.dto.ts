import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { OptionType } from '../../generated/prisma/enums.js';

export class ListOptionValuesQueryDto {
  @ApiPropertyOptional({ enum: OptionType, example: OptionType.SIZE })
  @IsOptional()
  @IsEnum(OptionType)
  type?: OptionType;

  @ApiPropertyOptional({ description: 'Kèm cả giá trị đang ẩn — chỉ STORE_MANAGER/MASTER_ADMIN', example: true })
  @IsOptional()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.includeHidden === 'true')
  @IsBoolean()
  includeHidden?: boolean;
}
