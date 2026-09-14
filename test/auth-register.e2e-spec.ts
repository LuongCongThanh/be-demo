import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureApp } from '../src/bootstrap/configure-app.js';

const TEST_EMAIL_DOMAIN = '@auth-register.e2e-test.local';

describe('Auth — POST /auth/register (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

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
      .post('/auth/register')
      .send({ email, password: 'Abc@1234' })
      .expect(201);

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

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'Abc@1234' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'Abc@1234' })
      .expect(409);
  });

  it('returns 400 when the password does not meet the policy', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `weak${Date.now()}${TEST_EMAIL_DOMAIN}`,
        password: 'abc12345',
      })
      .expect(400);
  });

  it('returns 400 for a malformed email', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'Abc@1234' })
      .expect(400);
  });

  it('returns 400 when the body has an unexpected extra field', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `extra${Date.now()}${TEST_EMAIL_DOMAIN}`,
        password: 'Abc@1234',
        isAdmin: true,
      })
      .expect(400);
  });
});
