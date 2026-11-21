import { TestingModule, Test } from '@nestjs/testing';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CliModule } from '#src/cli/cli.module.js';
import { CreateAdminCommand } from '#src/cli/create-admin.command.js';
import { PasswordPrompt } from '#src/cli/password-prompt.js';

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

  it('rejects creating a second active ADMIN with the prompted password', async () => {
    const activeAdmin = await prisma.userRole.findFirst({
      where: { role: { name: 'Admin', isSystem: true }, user: { status: 'ACTIVE' } },
      select: { userId: true },
    });
    expect(activeAdmin).not.toBeNull();

    const email = uniqueEmail();
    passwords = [VALID_PASSWORD, VALID_PASSWORD];

    const exitCode = await run(['--email', email, '--name', 'Quan Tri']);

    expect(exitCode).not.toBe(0);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(output.join('\n')).toMatch(/active Admin account already exists/i);
  });

  it('fails without touching the existing account when the email is taken', async () => {
    const before = await prisma.user.findFirstOrThrow({
      where: { role: 'ADMIN', status: 'ACTIVE' },
    });
    const email = before.email;

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
