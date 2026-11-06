import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

/** Chỉ lưu metadata — upload lên object storage nằm ngoài phạm vi; client gửi key. */
export class CreateImageDto {
  @ApiProperty({
    description: 'Color this image belongs to (BR-CAT-05)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  colorId!: string;

  @ApiProperty({ description: 'Object storage key, not an absolute URL', example: 'products/tshirt-basic/white-1.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  storageKey!: string;

  @ApiPropertyOptional({ maxLength: 255, example: 'Áo thun trắng, mặt trước' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0, example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Replaces the current primary image of this color',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
