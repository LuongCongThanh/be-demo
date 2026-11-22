import { TestingModule, Test } from '@nestjs/testing';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CliModule } from '#src/cli/cli.module.js';
import { CreateAdminCommand } from '#src/cli/create-admin.command.js';
import { PasswordPrompt } from '#src/cli/password-prompt.js';
import { PasswordService } from '#src/modules/identity/auth/services/shared/password.service.js';
import { InternalAccountService } from '#src/modules/identity/internal-account.service.js';

const TEST_EMAIL_DOMAIN = '@cli-create-admin.e2e-test.local';
const VALID_PASSWORD = 'Abcde@123456789';

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

  it('creates and audits an Admin when no active Admin exists', async () => {
    const activeAdmins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        status: 'ACTIVE',
        userRoles: { some: { role: { name: 'Admin', isSystem: true } } },
      },
      select: { id: true },
    });
    const email = uniqueEmail();
    passwords = [VALID_PASSWORD, VALID_PASSWORD];

    try {
      await prisma.user.updateMany({
        where: { id: { in: activeAdmins.map(({ id }) => id) } },
        data: { status: 'DISABLED' },
      });
      expect(
        await prisma.userRole.findFirst({
          where: { role: { name: 'Admin', isSystem: true }, user: { status: 'ACTIVE' } },
          select: { userId: true },
        }),
      ).toBeNull();

      const exitCode = await run(['--email', email, '--name', 'Quan Tri']);

      expect(exitCode).toBe(0);
      const admin = await prisma.user.findUniqueOrThrow({
        where: { email },
        include: { userRoles: { select: { role: { select: { name: true, isSystem: true } } } } },
      });
      expect(admin).toMatchObject({
        email,
        fullName: 'Quan Tri',
        role: 'ADMIN',
        status: 'ACTIVE',
        userRoles: [{ role: { name: 'Admin', isSystem: true } }],
      });
      expect(await moduleRef.get(PasswordService).verify(admin.passwordHash, VALID_PASSWORD)).toBe(true);

      const audit = await prisma.auditLog.findFirst({ where: { entityId: admin.id, action: 'admin.create' } });
      expect(audit).toMatchObject({
        actorUserId: null,
        action: 'admin.create',
        entityType: 'user',
        entityId: admin.id,
        after: { email, name: 'Quan Tri', role: 'ADMIN' },
      });
    } finally {
      const createdAdmin = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (createdAdmin) {
        await prisma.auditLog.deleteMany({ where: { entityId: createdAdmin.id } });
        await prisma.user.delete({ where: { id: createdAdmin.id } });
      }
      if (activeAdmins.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: activeAdmins.map(({ id }) => id) } },
          data: { status: 'ACTIVE' },
        });
      }
    }
  });
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

  it('creates exactly one active ADMIN when two service calls race', async () => {
    const activeAdmins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        status: 'ACTIVE',
        userRoles: { some: { role: { name: 'Admin', isSystem: true } } },
      },
      select: { id: true },
    });
    const emails = [uniqueEmail(), uniqueEmail()];

    try {
      await prisma.user.updateMany({
        where: { id: { in: activeAdmins.map(({ id }) => id) } },
        data: { status: 'DISABLED' },
      });

      const results = await Promise.allSettled(
        emails.map((email) =>
          moduleRef.get(InternalAccountService).create({
            email,
            name: 'Concurrent Admin',
            password: VALID_PASSWORD,
            role: 'ADMIN',
            actorUserId: null,
          }),
        ),
      );
      const created = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(created).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toMatchObject({
        message: expect.stringContaining('An active Admin account already exists'),
      });

      const activeAdminsAfterRace = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
          status: 'ACTIVE',
          userRoles: { some: { role: { name: 'Admin', isSystem: true } } },
        },
        select: { email: true },
      });
      expect(activeAdminsAfterRace).toHaveLength(1);
      expect(emails).toContain(activeAdminsAfterRace[0]?.email);
    } finally {
      const createdUsers = await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true },
      });
      const createdIds = createdUsers.map(({ id }) => id);
      await prisma.auditLog.deleteMany({ where: { entityId: { in: createdIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
      if (activeAdmins.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: activeAdmins.map(({ id }) => id) } },
          data: { status: 'ACTIVE' },
        });
      }
    }
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
