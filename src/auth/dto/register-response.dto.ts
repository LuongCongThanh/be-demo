import { ApiProperty } from '@nestjs/swagger';

/**
 * Response allow-list for POST /auth/register — deliberately excludes
 * passwordHash, tokens, and any accessToken/refreshToken (register does not
 * log the user in automatically; they must verify their email first).
 */
export class RegisterResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;
}
