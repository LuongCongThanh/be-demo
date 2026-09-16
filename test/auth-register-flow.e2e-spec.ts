import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MailService } from '../src/mail/mail.service.js';
import { EmailThrottlerGuard } from '../src/auth/guards/email-throttler.guard.js';
import { configureApp } from '../src/bootstrap/configure-app.js';

const ALWAYS_ALLOW = { canActivate: () => true };

const TEST_EMAIL_DOMAIN = '@auth-register-flow.e2e-test.local';

function uniqueEmail(prefix: string): string {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2)}${TEST_EMAIL_DOMAIN}`;
}

describe('Auth — full register flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailService: { sendVerificationEmail: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    mailService = { sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Real MailService would hit Mailtrap's SMTP over the network on every
      // run; stub it so the test is fast/offline and can read the raw code
      // straight from the call args instead of an inbox API.
      .overrideProvider(MailService)
      .useValue(mailService)
      // Not testing rate limiting here — this file exercises several
      // /auth/* routes across multiple requests per test. `ThrottlerGuard`
      // must be overridden as its own provider, not via overrideGuard()/
      // overrideProvider(APP_GUARD) — APP_GUARD is a `multi: true` token
      // (see src/app.module.ts), so that would only ADD a stub guard
      // alongside the real one instead of replacing it.
      .overrideProvider(ThrottlerGuard)
      .useValue(ALWAYS_ALLOW)
      .overrideGuard(EmailThrottlerGuard)
      .useValue(ALWAYS_ALLOW)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = moduleFixture.get(PrismaService);

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
    mailService.sendVerificationEmail.mockClear();
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
  });

  function validRegisterPayload(email: string) {
    return {
      email,
      password: 'Abc@1234',
      fullName: 'Nguyen Van A',
      phone: '0912345678',
    };
  }

  it('registers, verifies the emailed code, and marks the user as verified', async () => {
    const email = uniqueEmail('valid');

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(validRegisterPayload(email))
      .expect(201);

    expect(registerRes.body).toEqual({ id: expect.any(String), email });
    expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    const [sentTo, code] = mailService.sendVerificationEmail.mock.calls[0] as [string, string];
    expect(sentTo).toBe(email);
    expect(code).toMatch(/^\d{6}$/);

    const userBeforeVerify = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(userBeforeVerify.emailVerifiedAt).toBeNull();

    const verifyRes = await request(app.getHttpServer()).post('/auth/verify-email').send({ email, code }).expect(200);

    expect(verifyRes.body).toEqual({ message: 'Email verified successfully' });

    const userAfterVerify = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(userAfterVerify.emailVerifiedAt).not.toBeNull();
  });

  it('rejects registration with a duplicate email (409)', async () => {
    const email = uniqueEmail('dup');
    await request(app.getHttpServer()).post('/auth/register').send(validRegisterPayload(email)).expect(201);

    await request(app.getHttpServer()).post('/auth/register').send(validRegisterPayload(email)).expect(409);

    // Only the first attempt should have gone through the mail step.
    expect(mailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects registration with invalid input (400) and never sends an email', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short', fullName: '', phone: '' })
      .expect(400);

    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('fails verify-email with a wrong code right after registering', async () => {
    const email = uniqueEmail('wrong-code');
    await request(app.getHttpServer()).post('/auth/register').send(validRegisterPayload(email)).expect(201);

    await request(app.getHttpServer()).post('/auth/verify-email').send({ email, code: '000000' }).expect(404);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerifiedAt).toBeNull();
  });
});
