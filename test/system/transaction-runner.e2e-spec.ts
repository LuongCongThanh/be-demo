import { INestApplication } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import request from 'supertest';
import { Prisma } from '#src/generated/prisma/client.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { TransactionRunner } from '#src/infrastructure/database/transaction-runner.port.js';
import { IdempotencyStore } from '#src/infrastructure/idempotency/idempotency.port.js';
import { createTestApp } from '../support/create-test-app.js';

const SCOPE = 'e2e.transaction-runner';

describe('TransactionRunner on PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let runner: TransactionRunner;
  let store: IdempotencyStore;
  let prisma: PrismaService;
  let host: TransactionHost<TransactionalAdapterPrisma<PrismaService>>;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    runner = app.get(TransactionRunner);
    store = app.get(IdempotencyStore);
    prisma = app.get(PrismaService);
    host = app.get(TransactionHost);
  });

  afterEach(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { scope: SCOPE } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('commits writes made through the store inside run()', async () => {
    await runner.run(async () => {
      await store.start(SCOPE, 'commit', 'h'.repeat(64));
      await store.complete(SCOPE, 'commit', 201, { ok: true });
    });
    await expect(store.find(SCOPE, 'commit')).resolves.toEqual({
      requestHash: 'h'.repeat(64),
      responseStatus: 201,
      response: { ok: true },
    });
  });

  it('rolls back every write when the work throws', async () => {
    await expect(
      runner.run(async () => {
        await store.start(SCOPE, 'rollback', 'h'.repeat(64));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(store.find(SCOPE, 'rollback')).resolves.toBeNull();
  });

  it('shares one transaction with a nested run(): the outer failure undoes the inner write', async () => {
    await expect(
      runner.run(async () => {
        await runner.run(() => store.start(SCOPE, 'nested', 'h'.repeat(64)));
        throw new Error('outer fails');
      }),
    ).rejects.toThrow('outer fails');
    await expect(store.find(SCOPE, 'nested')).resolves.toBeNull();
  });

  it('applies opts.isolationLevel to the outermost transaction only', async () => {
    const level = () =>
      host.tx.$queryRaw<{ level: string }[]>`SELECT current_setting('transaction_isolation') AS level`.then(
        (rows) => rows[0].level,
      );
    const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

    await expect(runner.run(level, serializable)).resolves.toBe('serializable');
    await expect(runner.run(() => runner.run(level), serializable)).resolves.toBe('serializable');
    await expect(runner.run(level)).resolves.toBe('read committed');
  });

  it('keeps the right requestId on error responses for concurrent requests', async () => {
    // Server thật (cổng ngẫu nhiên) để các request chạy song song thật sự.
    await app.listen(0);
    const url = await app.getUrl();
    const ids = Array.from({ length: 8 }, (_, i) => `rid-${i}`);
    const responses = await Promise.all(
      ids.map((id) => request(url).post('/api/v1/auth/login').send({}).set('x-request-id', id)),
    );
    responses.forEach((res, i) => {
      expect(res.status).toBe(400);
      expect(res.body.requestId).toBe(ids[i]);
    });
  });
});
