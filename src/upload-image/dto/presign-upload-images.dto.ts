import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsIn, ValidateNested } from 'class-validator';
import { PresignImageFileDto } from './presign-image-file.dto.js';
import { MAX_PRESIGN_BATCH_SIZE } from '../object-storage/allowed-image-content-type.js';
import { UPLOAD_PURPOSES } from '../upload-purpose.js';
import type { UploadPurpose } from '../upload-purpose.js';

export class PresignUploadImagesDto {
  @ApiProperty({
    enum: UPLOAD_PURPOSES,
    example: 'PRODUCT_IMAGE',
    description: 'Ảnh upload để gắn vào đâu — quyết định prefix của key và role được phép',
  })
  @IsIn(UPLOAD_PURPOSES)
  purpose: UploadPurpose;

  @ApiProperty({ type: [PresignImageFileDto], maxItems: MAX_PRESIGN_BATCH_SIZE })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PRESIGN_BATCH_SIZE)
  @ValidateNested({ each: true })
  @Type(() => PresignImageFileDto)
  files: PresignImageFileDto[];
}
