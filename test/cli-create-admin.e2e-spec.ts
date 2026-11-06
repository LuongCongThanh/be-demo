import { TestingModule, Test } from '@nestjs/testing';
import { PrismaService } from '#src/prisma/prisma.service.js';
import { CliModule } from '#src/cli/cli.module.js';
import { CreateAdminCommand } from '#src/cli/create-admin.command.js';
import { PasswordPrompt } from '#src/cli/password-prompt.js';
import { PasswordService } from '#src/auth/services/password.service.js';

const TEST_EMAIL_DOMAIN = '@cli-create-admin.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

describe('CLI — create-admin (application context, prompt stubbed)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let passwords: string[];
  const output: string[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [CliModule] })
      .overrideProvider(PasswordPrompt)
      .useValue({ ask: async () => passwords.shift() ?? '' })
      .compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await moduleRef.close();
  });

  beforeEach(() => {
    output.length = 0;
  });

  const uniqueEmail = () => `admin${Date.now()}${Math.random().toString(36).slice(2)}${TEST_EMAIL_DOMAIN}`;
  const run = (args: string[]) =>
    moduleRef.get(CreateAdminCommand).run(args, { log: (m) => output.push(m), error: (m) => output.push(m) });

  it('creates an ADMIN with the prompted password and a system audit row', async () => {
    const email = uniqueEmail();
    passwords = [VALID_PASSWORD, VALID_PASSWORD];

    const exitCode = await run(['--email', email, '--name', 'Quan Tri']);

    expect(exitCode).toBe(0);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ role: 'ADMIN', status: 'ACTIVE', fullName: 'Quan Tri' });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(await moduleRef.get(PasswordService).verify(user.passwordHash, VALID_PASSWORD)).toBe(true);

    const audit = await prisma.auditLog.findMany({ where: { entityId: user.id } });
    expect(audit).toEqual([expect.objectContaining({ action: 'admin.create', actorUserId: null })]);
  });

  it('fails without touching the existing account when the email is taken', async () => {
    const email = uniqueEmail();
    passwords = [VALID_PASSWORD, VALID_PASSWORD];
    await run(['--email', email, '--name', 'First']);
    const before = await prisma.user.findUniqueOrThrow({ where: { email } });

    passwords = ['Xyz@9876', 'Xyz@9876'];
    const exitCode = await run(['--email', email, '--name', 'Second']);

    expect(exitCode).not.toBe(0);
    expect(await prisma.user.findUniqueOrThrow({ where: { email } })).toEqual(before);
  });

  it('rejects a weak password with the registration policy and creates nothing', async () => {
    const email = uniqueEmail();
    passwords = ['weak', 'weak'];

    expect(await run(['--email', email, '--name', 'Weak'])).not.toBe(0);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(output.join('\n')).toMatch(/Password must be/);
  });

  it('rejects mismatched password confirmation', async () => {
    const email = uniqueEmail();
    passwords = [VALID_PASSWORD, 'Other@1234'];

    expect(await run(['--email', email, '--name', 'Typo'])).not.toBe(0);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('requires --email and --name', async () => {
    passwords = [VALID_PASSWORD, VALID_PASSWORD];
    expect(await run(['--name', 'No Email'])).not.toBe(0);
  });
});
