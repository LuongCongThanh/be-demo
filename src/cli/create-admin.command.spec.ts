import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateAdminCommand } from '#src/cli/create-admin.command.js';
import type { InternalAccountService } from '#src/auth/services/internal-account.service.js';
import type { PasswordPrompt } from '#src/cli/password-prompt.js';

describe('CreateAdminCommand', () => {
  let accounts: { create: ReturnType<typeof vi.fn> };
  let answers: string[];
  let errors: string[];
  let command: CreateAdminCommand;
  const out = { log: vi.fn(), error: (m: string) => errors.push(m) };

  beforeEach(() => {
    accounts = { create: vi.fn() };
    errors = [];
    const prompt = { ask: vi.fn(async () => answers.shift() ?? '') };
    command = new CreateAdminCommand(
      accounts as unknown as InternalAccountService,
      prompt as unknown as PasswordPrompt,
    );
  });

  it('creates an ADMIN with no actor and returns 0', async () => {
    answers = ['Abc@1234', 'Abc@1234'];
    accounts.create.mockResolvedValue({ id: 'a1', email: 'a@x.local' });

    expect(await command.run(['--email', 'a@x.local', '--name', ' Quan Tri '], out)).toBe(0);
    expect(accounts.create).toHaveBeenCalledWith({
      email: 'a@x.local',
      name: 'Quan Tri',
      password: 'Abc@1234',
      role: 'ADMIN',
      actorUserId: null,
    });
  });

  it.each([[[]], [['--email', 'a@x.local']], [['--unknown', 'x']]])('returns 2 on bad arguments %j', async (args) => {
    answers = [];
    expect(await command.run(args, out)).toBe(2);
    expect(accounts.create).not.toHaveBeenCalled();
  });

  it('returns 1 when the confirmation does not match', async () => {
    answers = ['Abc@1234', 'Xyz@1234'];
    expect(await command.run(['--email', 'a@x.local', '--name', 'A'], out)).toBe(1);
    expect(errors).toContain('Passwords do not match');
  });

  it('returns 1 with the policy message for a weak password or bad email', async () => {
    answers = ['weak', 'weak'];
    expect(await command.run(['--email', 'not-an-email', '--name', 'A'], out)).toBe(1);
    expect(errors.join('\n')).toMatch(/Password must be/);
    expect(errors.join('\n')).toMatch(/email/);
    expect(accounts.create).not.toHaveBeenCalled();
  });

  it('returns 1 without overwriting when the email exists', async () => {
    answers = ['Abc@1234', 'Abc@1234'];
    accounts.create.mockRejectedValue(new ConflictException('Email is already in use'));
    expect(await command.run(['--email', 'a@x.local', '--name', 'A'], out)).toBe(1);
    expect(errors[0]).toMatch(/nothing was changed/);
  });

  it('rethrows unexpected errors', async () => {
    answers = ['Abc@1234', 'Abc@1234'];
    accounts.create.mockRejectedValue(new Error('db down'));
    await expect(command.run(['--email', 'a@x.local', '--name', 'A'], out)).rejects.toThrow('db down');
  });
});
