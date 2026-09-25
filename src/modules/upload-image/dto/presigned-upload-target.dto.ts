import { ApiProperty } from '@nestjs/swagger';

export class PresignedUploadTargetDto {
  @ApiProperty({
    example: 'tmp/product-image/550e8400-e29b-41d4-a716-446655440000.jpg',
    description: 'Gửi key này vào images[] của POST/PATCH /products — không gắn trong 1 ngày sẽ tự bị xoá',
  })
  key: string;

  @ApiProperty({ example: 'http://localhost:9000/media' })
  uploadUrl: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      key: 'tmp/product-image/c73fb45a-77a1-4875-a30e-28607156e2fc.jpg',
      'Content-Type': 'image/jpeg',
      Policy: 'eyJleHBpcmF0aW9uIjoi…',
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': 'minioadmin/20260924/us-east-1/s3/aws4_request',
      'X-Amz-Date': '20260924T084500Z',
      'X-Amz-Signature': '5d4f1c…',
    },
  })
  fields: Record<string, string>;
}
