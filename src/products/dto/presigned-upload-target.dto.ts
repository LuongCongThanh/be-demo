import { ApiProperty } from '@nestjs/swagger';

export class PresignedUploadTargetDto {
  @ApiProperty({ example: 'products/uploads/550e8400-abc.jpg' })
  key: string;

  @ApiProperty({ example: 'http://localhost:9000/product-images' })
  uploadUrl: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  fields: Record<string, string>;
}
