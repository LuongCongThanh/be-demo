import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsStrongPassword } from '#src/common/validation/is-strong-password.decorator.js';

class PasswordDto {
  @IsStrongPassword()
  password!: string;
}

async function validatePassword(password: string) {
  const dto = plainToInstance(PasswordDto, { password });
  return validate(dto);
}

describe('IsStrongPassword', () => {
  it('accepts a password with upper, lower, digit, special char, and 15+ length', async () => {
    const errors = await validatePassword('Abcde@123456789');

    expect(errors).toHaveLength(0);
  });

  it('rejects a password with no uppercase letter', async () => {
    const errors = await validatePassword('abc@1234');

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a password with no lowercase letter', async () => {
    const errors = await validatePassword('ABC@1234');

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a password with no digit', async () => {
    const errors = await validatePassword('Abc@efgh');

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a password with no special character', async () => {
    const errors = await validatePassword('Abc12345');

    expect(errors).not.toHaveLength(0);
  });

  it('rejects a password shorter than 15 characters, even if it meets every other rule', async () => {
    const errors = await validatePassword('Ab1@xyz1234567'); // 14 chars, all 4 character classes present

    expect(errors).not.toHaveLength(0);
  });

  it('accepts a password at the 15-character boundary', async () => {
    const errors = await validatePassword('Ab1@wxyz1234567'); // exactly 15 chars, all 4 classes present

    expect(errors).toHaveLength(0);
  });
});
