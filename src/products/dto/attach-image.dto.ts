import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AttachImageDto {
  @ApiProperty({
    description: 'Object key trả về từ POST /products/images/presign',
    example: 'products/uploads/abc.jpg',
  })
  @IsNotEmpty()
  @IsString()
  key: string;

  @ApiPropertyOptional({ maxLength: 255, example: 'Front view' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
