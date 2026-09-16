import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { IsStrongPassword } from '../decorators/is-strong-password.decorator.js';

@ValidatorConstraint({ name: 'MatchesPassword', async: false })
class MatchesPasswordConstraint implements ValidatorConstraintInterface {
  validate(confirmPassword: string, args: ValidationArguments) {
    const dto = args.object as ResetPasswordDto;
    return confirmPassword === dto.password;
  }
  defaultMessage() {
    return 'confirmPassword must match password';
  }
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Raw token received via email' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewAbc@1234' })
  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: 'NewAbc@1234' })
  @IsString()
  @Validate(MatchesPasswordConstraint)
  confirmPassword: string;
}
