import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Raw token received from the email verification link',
  })
  @IsString()
  token: string;
}
