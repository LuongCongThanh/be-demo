import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsStrongPassword } from '#src/common/validation/is-strong-password.decorator.js';

export class CreateStaffDto {
  @ApiProperty({ example: 'staff@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Nguyen Van B' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'Abc@1234', description: 'Initial password, same policy as registration' })
  @IsString()
  @IsStrongPassword()
  password!: string;
}
