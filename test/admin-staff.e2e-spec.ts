import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { PasswordService } from '#src/modules/identity/auth/password.service.js';
import type { AccountType } from '#src/generated/prisma/enums.js';
import { createTestUser } from './support/create-test-user.js';
import { createTestApp } from './support/create-test-app.js';

const TEST_EMAIL_DOMAIN = '@admin-staff.e2e-test.local';
const VALID_PASSWORD = 'Abc@1234';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

describe('Admin — staff management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let adminToken: string;
  let adminId: string;
  let customerToken: string;
  let staffToken: string;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
    passwordService = created.moduleFixture.get(PasswordService);

    ({ token: adminToken, id: adminId } = await userWithToken('ADMIN'));
    ({ token: customerToken } = await userWithToken('CUSTOMER'));
    ({ token: staffToken } = await userWithToken('STAFF'));
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: { in: ids } }, { entityId: { in: ids } }] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  const server = () => app.getHttpServer();
  const uniqueEmail = (prefix: string) =>
    `${prefix}${Date.now()}${Math.random().toString(36).slice(2)}${TEST_EMAIL_DOMAIN}`;

  async function userWithToken(role: AccountType) {
    const user = await createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix: `${role.toLowerCase()}-`,
      passwordHash: await passwordService.hash(VALID_PASSWORD),
      role,
      emailVerifiedAt: new Date(),
    });
    const res = await login(user.email).expect(200);
    return { id: user.id, email: user.email, token: res.body.accessToken as string };
  }

  function login(email: string, password = VALID_PASSWORD) {
    return request(server()).post('/api/v1/auth/login').send({ email, password });
  }

  async function createStaff(name = 'Nhan Vien A') {
    const email = uniqueEmail('staff-');
    const res = await request(server())
      .post('/api/v1/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, name, password: VALID_PASSWORD })
      .expect(201);
    return { id: res.body.id as string, email, body: res.body };
  }

  async function auditRows(entityId: string, action: string) {
    return prisma.auditLog.findMany({ where: { entityId, action } });
  }

  describe('role separation', () => {
    it('STAFF gets 403 on /admin/staff', async () => {
      await request(server()).get('/api/v1/admin/staff').set('Authorization', `Bearer ${staffToken}`).expect(403);
    });

    it('CUSTOMER gets 403 on /admin/staff', async () => {
      await request(server()).get('/api/v1/admin/staff').set('Authorization', `Bearer ${customerToken}`).expect(403);
    });

    it('STAFF gets 403 on the customer-only GET /me', async () => {
      await request(server()).get('/api/v1/me').set('Authorization', `Bearer ${staffToken}`).expect(403);
    });

    it('CUSTOMER can call GET /me', async () => {
      const res = await request(server()).get('/api/v1/me').set('Authorization', `Bearer ${customerToken}`).expect(200);
      expect(res.body).toMatchObject({ email: expect.stringContaining(TEST_EMAIL_DOMAIN) });
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('CRUD', () => {
    it('ADMIN creates a staff account that can log in with role STAFF', async () => {
      const { id, email, body } = await createStaff();

      expect(body).toMatchObject({ id, email, name: 'Nhan Vien A', status: 'ACTIVE' });
      expect(body).not.toHaveProperty('passwordHash');
      const res = await login(email).expect(200);
      expect(res.body.user.role).toBe('STAFF');
      expect(await auditRows(id, 'staff.create')).toHaveLength(1);
    });

    it('creating staff with an existing email returns 409', async () => {
      const { email } = await createStaff();
      await request(server())
        .post('/api/v1/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, name: 'Dup', password: VALID_PASSWORD })
        .expect(409);
    });

    it('creating staff with a weak password returns 400', async () => {
      await request(server())
        .post('/api/v1/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: uniqueEmail('weak-'), name: 'Weak', password: 'abc' })
        .expect(400);
    });

    it('lists only STAFF accounts in a paginated envelope', async () => {
      const { id } = await createStaff();
      const res = await request(server())
        .get('/api/v1/admin/staff?limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.meta).toMatchObject({ page: 1, limit: 100 });
      const ids = res.body.data.map((s: { id: string }) => s.id);
      expect(ids).toContain(id);
      expect(ids).not.toContain(adminId);
    });

    it('renames a staff account and records staff.rename', async () => {
      const { id } = await createStaff();
      const res = await request(server())
        .patch(`/api/v1/admin/staff/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Ten Moi' })
        .expect(200);

      expect(res.body.name).toBe('Ten Moi');
      expect(await auditRows(id, 'staff.rename')).toHaveLength(1);
    });

    it('renaming to the current name changes nothing and writes no audit row', async () => {
      const { id } = await createStaff('Giu Nguyen');
      await request(server())
        .patch(`/api/v1/admin/staff/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Giu Nguyen' })
        .expect(200);
      expect(await auditRows(id, 'staff.rename')).toHaveLength(0);
    });

    it('returns 404 when the target is not a staff account (admin, customer, missing)', async () => {
      for (const id of [adminId, MISSING_ID]) {
        await request(server())
          .post(`/api/v1/admin/staff/${id}/disable`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      }
      await request(server())
        .patch(`/api/v1/admin/staff/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Hijack' })
        .expect(404);
    });
  });

  describe('disable / enable', () => {
    it('disabling kills the live session: access token 401, refresh 401, login refused', async () => {
      const { id, email } = await createStaff();
      const loginRes = await login(email).expect(200);
      const staffAccess = loginRes.body.accessToken;
      const refreshCookie = (loginRes.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith('refresh_token='),
      )!;

      await request(server())
        .post(`/api/v1/admin/staff/${id}/disable`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(server()).get('/api/v1/auth/me').set('Authorization', `Bearer ${staffAccess}`).expect(401);
      await request(server()).post('/api/v1/auth/refresh').set('Cookie', refreshCookie).expect(401);

      const refused = await login(email).expect(401);
      expect(refused.body.message).toBe('Invalid email or password');
      expect(await auditRows(id, 'staff.disable')).toHaveLength(1);
    });

    it('disable and enable are idempotent and enabling restores login', async () => {
      const { id, email } = await createStaff();
      for (let i = 0; i < 2; i++) {
        const res = await request(server())
          .post(`/api/v1/admin/staff/${id}/disable`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(res.body.status).toBe('DISABLED');
      }
      for (let i = 0; i < 2; i++) {
        const res = await request(server())
          .post(`/api/v1/admin/staff/${id}/enable`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(res.body.status).toBe('ACTIVE');
      }

      await login(email).expect(200);
      expect(await auditRows(id, 'staff.enable')).toHaveLength(1);
    });
  });

  it('register with an internal account email returns the same error as any taken email', async () => {
    const { email: staffEmail } = await createStaff();
    const payload = (email: string) => ({ email, password: VALID_PASSWORD, fullName: 'Khach', phone: '0912345678' });
    const { email: customerEmail } = await userWithToken('CUSTOMER');

    const internal = await request(server()).post('/api/v1/auth/register').send(payload(staffEmail));
    const taken = await request(server()).post('/api/v1/auth/register').send(payload(customerEmail));

    expect(internal.status).toBe(taken.status);
    expect(internal.body.message).toBe(taken.body.message);
  });
});
