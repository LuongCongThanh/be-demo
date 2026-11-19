import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class CategoryLocaleQueryDto {
  @ApiPropertyOptional({ enum: ['vi', 'en'], default: 'vi', example: 'en' })
  @IsOptional()
  @IsIn(['vi', 'en'])
  locale?: 'vi' | 'en';
}
