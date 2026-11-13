import { ApiProperty } from '@nestjs/swagger';

export class PresignedImageUploadResponseDto {
  @ApiProperty({ description: 'POST a multipart form here: every `fields` entry, then the file as `file`' })
  uploadUrl: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' }, description: 'Signed form fields' })
  fields: Record<string, string>;

  @ApiProperty({ description: 'Send this to POST /admin/products/:id/images after the upload succeeds' })
  storageKey: string;

  @ApiProperty({ description: 'The signature stops working after this time' })
  expiresAt: Date;
}
