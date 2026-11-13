import { ApiProperty } from '@nestjs/swagger';
import { Role } from '#src/generated/prisma/enums.js';

export class AuthUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.CUSTOMER })
  role: Role;

  @ApiProperty()
  emailVerified: boolean;
}
