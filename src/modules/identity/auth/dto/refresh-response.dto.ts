import { ApiProperty } from '@nestjs/swagger';

export class RefreshResponseDto {
  @ApiProperty()
  accessToken: string;
  // KHÔNG có refreshToken — cookie mới được set qua Set-Cookie header,
  // không lặp lại trong body.
}
