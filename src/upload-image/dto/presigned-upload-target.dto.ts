import { ApiProperty } from '@nestjs/swagger';

export class PresignedUploadTargetDto {
  @ApiProperty({
    example: 'tmp/product-image/550e8400-e29b-41d4-a716-446655440000.jpg',
    description: 'Gửi key này vào images[] của POST/PATCH /products — không gắn trong 1 ngày sẽ tự bị xoá',
  })
  key: string;

  @ApiProperty({ example: 'http://localhost:9000/media' })
  uploadUrl: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  fields: Record<string, string>;
}
