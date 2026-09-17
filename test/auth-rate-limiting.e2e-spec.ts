import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/auth/services/password.service.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { createTestUser } from './support/create-test-user.js';

const TEST_EMAIL_DOMAIN = '@auth-rate-limiting.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

// Unlike every other e2e spec, this file does NOT stub out the throttler
// guards (see test/support/create-test-app.ts) — it exists specifically to
// verify the real 429 behavior from 12-rate-limiting.md.
describe('Auth — rate limiting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    passwordService = moduleFixture.get(PasswordService);

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
    const passwordHash = await passwordService.hash(VALID_PASSWORD);

    return createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix,
      passwordHash,
      emailVerifiedAt: new Date(),
    });
  }

  it('blocks the 6th /auth/login request in a minute from the same IP with 429', async () => {
    const user = await createUser('login-throttle');

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      // Alternates right/wrong password — a legitimate user retrying after a
      // typo must still hit the limit the same as a brute-force attempt; the
      // limit is per-IP, not conditioned on whether the attempt succeeded.
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: i === 0 ? 'wrong-password' : VALID_PASSWORD });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 5)).not.toContain(429);
    expect(statuses[5]).toBe(429);
  });

  it('blocks the 2nd /auth/forgot-password request within 60s for the same email with 429', async () => {
    const user = await createUser('forgot-password-throttle');

    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: user.email }).expect(200);

    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: user.email }).expect(429);
  });

  it('does not throttle a different email on /auth/forgot-password (per-email tracking, not per-IP)', async () => {
    const userA = await createUser('email-a');
    const userB = await createUser('email-b');

    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: userA.email }).expect(200);
    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email: userB.email }).expect(200);
  }, 15000); // 2 real SMTP sends against the sandbox provider; default 5s can be too tight.

  it('applies the default global limit (20/min/IP) to a route with no route-specific @Throttle(), e.g. GET /auth/me', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      // No Authorization header — each request would 401 on its own merits,
      // but the throttler guard runs first, so the 21st must be 429, not 401.
      const res = await request(app.getHttpServer()).get('/auth/me');
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 20)).not.toContain(429);
    expect(statuses[20]).toBe(429);
  });
});
