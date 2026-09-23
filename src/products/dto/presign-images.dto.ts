import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { PresignImageFileDto } from './presign-image-file.dto.js';
import { MAX_PRESIGN_BATCH_SIZE } from '../object-storage/allowed-image-content-type.js';

export class PresignImagesDto {
  @ApiProperty({ type: [PresignImageFileDto], maxItems: MAX_PRESIGN_BATCH_SIZE })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PRESIGN_BATCH_SIZE)
  @ValidateNested({ each: true })
  @Type(() => PresignImageFileDto)
  files: PresignImageFileDto[];
}
