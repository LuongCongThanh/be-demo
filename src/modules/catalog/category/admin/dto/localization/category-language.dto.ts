import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateCategoryLanguageDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;
}
