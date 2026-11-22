import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{8,15}$/)
  phone?: string;

  @ApiPropertyOptional({ enum: ['vi', 'en'] })
  @IsOptional()
  @IsIn(['vi', 'en'])
  interfaceLocale?: 'vi' | 'en';

  @ApiPropertyOptional({ enum: ['vi', 'en'] })
  @IsOptional()
  @IsIn(['vi', 'en'])
  emailLocale?: 'vi' | 'en';
}
