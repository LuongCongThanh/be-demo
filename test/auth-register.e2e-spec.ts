import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@src/prisma/prisma.service.js';
import { createTestApp } from './support/create-test-app.js';

const TEST_EMAIL_DOMAIN = '@auth-register.e2e-test.local';

// fullName/phone are required on RegisterDto but not what most of these
// tests are about — a shared valid payload keeps each request's own
// overrides (the part that actually matters) visible at a glance.
function validRegisterPayload(overrides: Record<string, unknown> = {}) {
  return {
    password: 'Abc@1234',
    fullName: 'Nguyen Van A',
    phone: '0912345678',
    ...overrides,
  };
}

describe('Auth — POST /auth/register (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    const moduleFixture = created.moduleFixture;

    prisma = moduleFixture.get(PrismaService);

    // The CUSTOMER role must exist for register() to succeed — idempotent
    // upsert, same approach the future seed script will use.
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

  it('registers a new user and returns 201 with only id + email', async () => {
    const email = `new-user${Date.now()}${TEST_EMAIL_DOMAIN}`;

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(validRegisterPayload({ email }))
      .expect(201);

    // Verify API versioning is enforced: unversioned path must return 404
    await request(app.getHttpServer()).post('/auth/register').send(validRegisterPayload({ email })).expect(404);

    expect(res.body).toEqual({ id: expect.any(String), email });
    expect(res.body).not.toHaveProperty('passwordHash');

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).not.toBe('Abc@1234');

    const roles = await prisma.userRole.findMany({
      where: { userId: user.id },
    });
    expect(roles).toHaveLength(1);

    const verificationTokens = await prisma.emailVerificationToken.findMany({
      where: { userId: user.id },
    });
    expect(verificationTokens).toHaveLength(1);
  });

  it('returns 409 when the email is already registered', async () => {
    const email = `dup${Date.now()}${TEST_EMAIL_DOMAIN}`;

    await request(app.getHttpServer()).post('/api/v1/auth/register').send(validRegisterPayload({ email })).expect(201);

    await request(app.getHttpServer()).post('/api/v1/auth/register').send(validRegisterPayload({ email })).expect(409);
  });

  it('returns 400 when the password does not meet the policy', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(
        validRegisterPayload({
          email: `weak${Date.now()}${TEST_EMAIL_DOMAIN}`,
          password: 'abc12345',
        }),
      )
      .expect(400);
  });

  it('returns 400 for a malformed email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(validRegisterPayload({ email: 'not-an-email' }))
      .expect(400);
  });

  it('returns 400 when fullName is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `nofullname${Date.now()}${TEST_EMAIL_DOMAIN}`,
        password: 'Abc@1234',
        phone: '0912345678',
      })
      .expect(400);
  });

  it('returns 400 when phone is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `nophone${Date.now()}${TEST_EMAIL_DOMAIN}`,
        password: 'Abc@1234',
        fullName: 'Nguyen Van A',
      })
      .expect(400);
  });

  it('returns 400 when the body has an unexpected extra field', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(
        validRegisterPayload({
          email: `extra${Date.now()}${TEST_EMAIL_DOMAIN}`,
          isAdmin: true,
        }),
      )
      .expect(400);
  });
});
