import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ type: [String] })
  roles: string[];

  @ApiProperty()
  emailVerified: boolean;
}
