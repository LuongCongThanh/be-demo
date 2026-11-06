import { ConflictException, Injectable } from '@nestjs/common';
import { parseArgs } from 'node:util';
import { plainToInstance } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, validate } from 'class-validator';
import { IsStrongPassword } from '#src/common/validation/is-strong-password.decorator.js';
import { InternalAccountService } from '#src/modules/identity/services/internal-account/internal-account.service.js';
import { PasswordPrompt } from '#src/cli/password-prompt.js';

export interface CliOutput {
  log(message: string): void;
  error(message: string): void;
}

class CreateAdminInput {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsStrongPassword()
  password!: string;
}

/**
 * `npm run cli -- create-admin --email <email> --name <name>` (identity.md
 * §5.4, US-1001). Cách hợp lệ duy nhất để tạo Admin — không có endpoint HTTP.
 * Trả exit code thay vì gọi `process.exit` để test gọi thẳng được.
 */
@Injectable()
export class CreateAdminCommand {
  constructor(
    private readonly internalAccounts: InternalAccountService,
    private readonly prompt: PasswordPrompt,
  ) {}

  async run(args: string[], out: CliOutput = console): Promise<number> {
    let email: string | undefined;
    let name: string | undefined;
    try {
      ({
        values: { email, name },
      } = parseArgs({ args, options: { email: { type: 'string' }, name: { type: 'string' } } }));
    } catch (err) {
      out.error((err as Error).message);
      return 2;
    }
    if (!email || !name) {
      out.error('Usage: create-admin --email <email> --name <name>');
      return 2;
    }

    const password = await this.prompt.ask('Password: ');
    const confirmation = await this.prompt.ask('Confirm password: ');
    if (password !== confirmation) {
      out.error('Passwords do not match');
      return 1;
    }

    const input = plainToInstance(CreateAdminInput, { email, name: name.trim(), password });
    const errors = await validate(input);
    if (errors.length > 0) {
      for (const e of errors) out.error(Object.values(e.constraints ?? {}).join('; '));
      return 1;
    }

    try {
      const admin = await this.internalAccounts.create({ ...input, role: 'ADMIN', actorUserId: null });
      out.log(`Created admin ${admin.email} (${admin.id})`);
      return 0;
    } catch (err) {
      if (err instanceof ConflictException) {
        out.error(`${email}: ${err.message} — nothing was changed`);
        return 1;
      }
      throw err;
    }
  }
}
