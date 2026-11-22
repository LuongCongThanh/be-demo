import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CustomerAddressDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MaxLength(255)
  fullName: string;

  @ApiProperty({ example: '0912345678' })
  @IsString()
  @Matches(/^[0-9+\-\s]{8,15}$/)
  phone: string;

  @ApiProperty({ example: '79' })
  @IsString()
  @MaxLength(20)
  provinceCode: string;

  @ApiProperty({ example: 'TP Ho Chi Minh' })
  @IsString()
  @MaxLength(255)
  provinceName: string;

  @ApiProperty({ example: '767' })
  @IsString()
  @MaxLength(20)
  wardCode: string;

  @ApiProperty({ example: 'Phuong X' })
  @IsString()
  @MaxLength(255)
  wardName: string;

  @ApiProperty({ example: '12 Nguyen Trai' })
  @IsString()
  @MaxLength(500)
  addressLine: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
