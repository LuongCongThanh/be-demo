import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { VariantStatus } from '../../generated/prisma/enums.js';
import { CreateVariantDto } from './create-variant.dto.js';

export class UpdateVariantDto extends PartialType(CreateVariantDto) {
  @ApiPropertyOptional({ enum: VariantStatus })
  @IsOptional()
  @IsEnum(VariantStatus)
  status?: VariantStatus;
}
