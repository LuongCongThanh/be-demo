import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PasswordService } from '../src/auth/services/password.service.js';
import { configureApp } from '../src/bootstrap/configure-app.js';
import { createTestUser } from './support/create-test-user.js';

const TEST_EMAIL_DOMAIN = '@auth-me.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';

describe('Auth — GET /auth/me (e2e)', () => {
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

  async function loginAndGetAccessToken(email: string): Promise<string> {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password: VALID_PASSWORD });
    return res.body.accessToken;
  }

  it('returns 401 when no Authorization header is present', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('returns 401 when the access token is malformed', async () => {
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer not-a-real-jwt').expect(401);
  });

  it('returns the current user for a valid access token, without leaking passwordHash', async () => {
    const user = await createUser('valid');
    const accessToken = await loginAndGetAccessToken(user.email);

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body).toEqual({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: ['CUSTOMER'],
      emailVerified: true,
    });
    expect(res.body).not.toHaveProperty('passwordHash');
  });
});
