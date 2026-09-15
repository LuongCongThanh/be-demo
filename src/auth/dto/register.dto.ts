import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { IsStrongPassword } from '../decorators/is-strong-password.decorator.js';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Abc@1234' })
  @IsString()
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  fullName!: string;

  @ApiProperty({ example: '0912345678' })
  @IsString()
  @Matches(/^[0-9+\-\s]{8,15}$/, { message: 'phone must be a valid phone number' })
  phone!: string;
}
