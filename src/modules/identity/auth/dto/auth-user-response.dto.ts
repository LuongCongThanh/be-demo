import { ApiProperty } from '@nestjs/swagger';
import { AccountType } from '#src/generated/prisma/enums.js';

export class AuthUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: AccountType, enumName: 'Role', example: AccountType.CUSTOMER })
  role: AccountType;

  @ApiProperty()
  emailVerified: boolean;
}
