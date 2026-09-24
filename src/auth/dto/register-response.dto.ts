import { ApiProperty } from '@nestjs/swagger';

/**
 * Response allow-list for POST /auth/register — deliberately excludes
 * passwordHash, tokens, and any accessToken/refreshToken (register does not
 * log the user in automatically; they must verify their email first).
 */
export class RegisterResponseDto {
  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7' })
  id!: string;

  @ApiProperty({ example: 'nguyenvana@example.com' })
  email!: string;
}
