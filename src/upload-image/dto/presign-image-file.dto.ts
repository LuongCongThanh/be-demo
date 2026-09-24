import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ALLOWED_IMAGE_CONTENT_TYPES } from '../object-storage/allowed-image-content-type.js';
import type { AllowedImageContentType } from '../object-storage/allowed-image-content-type.js';

export class PresignImageFileDto {
  @ApiProperty({ maxLength: 255, example: 'front.jpg' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  filename: string;

  @ApiProperty({ enum: ALLOWED_IMAGE_CONTENT_TYPES, example: 'image/jpeg' })
  @IsIn(ALLOWED_IMAGE_CONTENT_TYPES)
  contentType: AllowedImageContentType;
}
