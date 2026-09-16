import { ApiProperty } from '@nestjs/swagger';
import { AuthUserResponseDto } from './auth-user-response.dto.js';

export class LoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
  // KHÔNG có refreshToken — nằm trong cookie (quyết định #17)
}
