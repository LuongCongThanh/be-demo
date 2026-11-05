import { ApiProperty } from '@nestjs/swagger';

/** Shape lỗi duy nhất do `AllExceptionsFilter` trả về cho mọi status 4xx/5xx. */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    description: 'Thông báo lỗi; là mảng khi validate DTO thất bại (mỗi phần tử 1 lỗi field)',
    example: 'Category #3f2a… not found',
  })
  message: string | string[];

  @ApiProperty({
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    description: 'Trùng header X-Request-Id, dùng để tra log',
  })
  requestId: string;
}
