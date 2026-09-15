import { randomInt } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { TokenService } from '../src/auth/services/token.service.js';
import { configureApp } from '../src/bootstrap/configure-app.js';

const TEST_EMAIL_DOMAIN = '@auth-verify-email.e2e-test.local';

function randomCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

describe('Auth — POST /auth/verify-email (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    tokenService = moduleFixture.get(TokenService);

    // verifyEmail() doesn't touch roles, but the FK on User still requires
    // CUSTOMER to exist for the createUser() helper below to succeed.
    await prisma.role.upsert({
      where: { name: 'CUSTOMER' },
      update: {},
      create: { name: 'CUSTOMER' },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
    });
  });

  async function createUser(emailSuffix: string) {
    const email = `${emailSuffix}${Date.now()}${Math.random().toString(36).slice(2)}${TEST_EMAIL_DOMAIN}`;
    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: 'CUSTOMER' } });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'irrelevant-for-this-test',
        fullName: 'Nguyen Van A',
        phone: '0912345678',
        status: 'ACTIVE',
        userRoles: { create: [{ roleId: customerRole.id }] },
      },
    });

    return user;
  }

  async function createCodeFor(userId: string, overrides: { verifiedAt?: Date; expiresAt?: Date } = {}) {
    const code = randomCode();
    const tokenHash = tokenService.hashRawToken(code);

    await prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
        verifiedAt: overrides.verifiedAt,
      },
    });

    return code;
  }

  it('verifies the email and returns 200 with a success message', async () => {
    const user = await createUser('valid');
    const code = await createCodeFor(user.id);

    const res = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email: user.email, code })
      .expect(200);

    expect(res.body).toEqual({ message: 'Email verified successfully' });

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.emailVerifiedAt).not.toBeNull();

    const tokenRecord = await prisma.emailVerificationToken.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(tokenRecord.verifiedAt).not.toBeNull();
  });

  it('returns 404 when the email does not exist', async () => {
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email: `nobody${Date.now()}${TEST_EMAIL_DOMAIN}`, code: randomCode() })
      .expect(404);
  });

  it('returns 404 when the code does not match the email', async () => {
    const user = await createUser('wrong-code');
    await createCodeFor(user.id);

    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email: user.email, code: randomCode() })
      .expect(404);
  });

  it('returns 404 when the code belongs to a different user', async () => {
    const owner = await createUser('owner');
    const other = await createUser('other');
    const code = await createCodeFor(owner.id);

    await request(app.getHttpServer()).post('/auth/verify-email').send({ email: other.email, code }).expect(404);
  });

  it('returns 400 when the code was already used (replay protection)', async () => {
    const user = await createUser('replay');
    const code = await createCodeFor(user.id);

    await request(app.getHttpServer()).post('/auth/verify-email').send({ email: user.email, code }).expect(200);

    await request(app.getHttpServer()).post('/auth/verify-email').send({ email: user.email, code }).expect(400);
  });

  it('returns 400 when the code has expired', async () => {
    const user = await createUser('expired');
    const code = await createCodeFor(user.id, { expiresAt: new Date(Date.now() - 1000) });

    await request(app.getHttpServer()).post('/auth/verify-email').send({ email: user.email, code }).expect(400);

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.emailVerifiedAt).toBeNull();
  });

  it('returns 400 when the code is not a 6-digit number', async () => {
    const user = await createUser('malformed');
    await createCodeFor(user.id);

    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email: user.email, code: '12a456' })
      .expect(400);
  });

  it('locks out further attempts after 5 wrong guesses, even with the correct code', async () => {
    const user = await createUser('lockout');
    const code = await createCodeFor(user.id);

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email: user.email, code: randomCode() })
        .expect(404);
    }

    await request(app.getHttpServer()).post('/auth/verify-email').send({ email: user.email, code }).expect(400);

    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.emailVerifiedAt).toBeNull();
  });

  it('only one of two concurrent requests with the same code succeeds', async () => {
    const user = await createUser('race');
    const code = await createCodeFor(user.id);

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post('/auth/verify-email').send({ email: user.email, code }),
      request(app.getHttpServer()).post('/auth/verify-email').send({ email: user.email, code }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 400]);
  });
});
