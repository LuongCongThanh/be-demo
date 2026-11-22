import { applyDecorators } from '@nestjs/common';
import { Matches, MinLength } from 'class-validator';

/**
 * Password policy: at least 15 characters, with an uppercase letter, a
 * lowercase letter, a number, and a special character (decision #9,
 * docs/auth-playbook/00-overview.md). Shared between RegisterDto and
 * ResetPasswordDto so the rule only needs to change in one place.
 */
export function IsStrongPassword() {
  return applyDecorators(
    MinLength(15),
    Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
      message:
        'Password must be at least 15 characters and include an uppercase letter, a lowercase letter, a number, and a special character',
    }),
  );
}
