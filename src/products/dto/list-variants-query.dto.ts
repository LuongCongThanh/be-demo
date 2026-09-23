import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { VariantStatus } from '../../generated/prisma/enums.js';
import { PaginationDto } from './pagination.dto.js';

export class ListVariantsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: VariantStatus, example: VariantStatus.ACTIVE })
  @IsOptional()
  @IsEnum(VariantStatus)
  status?: VariantStatus;
}
