import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ClsPluginTransactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ClsModule } from 'nestjs-cls';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '#src/generated/prisma/client.js';
import { AuditLog } from '#src/infrastructure/audit/audit-log.port.js';
import { AuditModule } from '#src/infrastructure/audit/audit.module.js';
import { ClsTransactionRunner } from '#src/infrastructure/database/cls-transaction-runner.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { TransactionRunner } from '#src/infrastructure/database/transaction-runner.port.js';
import { IdempotencyStore } from '#src/infrastructure/idempotency/idempotency.port.js';
import { IdempotencyModule } from '#src/infrastructure/idempotency/idempotency.module.js';
import { MailSender } from '#src/infrastructure/mail/mail.port.js';
import { MailModule } from '#src/infrastructure/mail/mail.module.js';
import { ImageStorage } from '#src/infrastructure/storage/storage.port.js';
import { StorageModule } from '#src/infrastructure/storage/storage.module.js';

// Giả lập PrismaClient: `$transaction` chạy callback với client `tx` riêng và
// ghi lại tuỳ chọn; throw trong callback = rollback (ghi vào `log`).
function createFakePrisma() {
  const log: string[] = [];
  const calls: unknown[] = [];
  const fake = {
    marker: 'root',
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>, opts?: unknown) => {
      calls.push(opts);
      const tx = { marker: 'tx' };
      try {
        const result = await fn(tx);
        log.push('commit');
        return result;
      } catch (error) {
        log.push('rollback');
        throw error;
      }
    }),
  };
  return { fake, log, calls };
}

async function setup() {
  const { fake, log, calls } = createFakePrisma();
  @Global()
  @Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
  class FakePrismaModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [
      FakePrismaModule,
      ClsModule.forRoot({
        global: true,
        plugins: [
          new ClsPluginTransactional({
            imports: [FakePrismaModule],
            adapter: new TransactionalAdapterPrisma<PrismaService>({ prismaInjectionToken: PrismaService }),
          }),
        ],
      }),
    ],
    providers: [ClsTransactionRunner, { provide: TransactionRunner, useExisting: ClsTransactionRunner }],
  }).compile();
  return { moduleRef, log, calls, fake };
}

describe('TransactionRunner (ClsTransactionRunner)', () => {
  it('commits when the work resolves and returns its result', async () => {
    const { moduleRef, log } = await setup();
    const runner = moduleRef.get(TransactionRunner);
    await expect(runner.run(async () => 'done')).resolves.toBe('done');
    expect(log).toEqual(['commit']);
  });

  it('rolls back and rethrows when the work throws', async () => {
    const { moduleRef, log } = await setup();
    const runner = moduleRef.get(TransactionRunner);
    await expect(runner.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(log).toEqual(['rollback']);
  });

  it('joins a nested run() into the outer transaction', async () => {
    const { moduleRef, log, fake } = await setup();
    const runner = moduleRef.get(TransactionRunner);
    const host = moduleRef.get<TransactionHost<TransactionalAdapterPrisma<PrismaService>>>(TransactionHost);
    const seen: unknown[] = [];
    await runner.run(async () => {
      seen.push(host.tx);
      await runner.run(async () => {
        seen.push(host.tx);
      });
    });
    expect(fake.$transaction).toHaveBeenCalledTimes(1);
    expect(seen[0]).toBe(seen[1]);
    expect(log).toEqual(['commit']);
  });

  it('applies isolationLevel, timeout and maxWait to the outermost transaction', async () => {
    const { moduleRef, calls } = await setup();
    const runner = moduleRef.get(TransactionRunner);
    const opts = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 9000, maxWait: 3000 };
    await runner.run(() => runner.run(async () => undefined), opts);
    expect(calls).toEqual([expect.objectContaining(opts)]);
  });

  it('uses the plain client outside a transaction', async () => {
    const { moduleRef, fake } = await setup();
    const host = moduleRef.get<TransactionHost<TransactionalAdapterPrisma<PrismaService>>>(TransactionHost);
    expect(host.tx).toBe(fake);
  });
});

describe('shared ports resolve by abstract class', () => {
  it('injects Mail, Storage, Audit and Idempotency ports', async () => {
    const { fake } = createFakePrisma();
    @Global()
    @Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
    class FakePrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        FakePrismaModule,
        ClsModule.forRoot({
          global: true,
          plugins: [
            new ClsPluginTransactional({
              imports: [FakePrismaModule],
              adapter: new TransactionalAdapterPrisma<PrismaService>({ prismaInjectionToken: PrismaService }),
            }),
          ],
        }),
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        MailModule,
        StorageModule,
        AuditModule,
        IdempotencyModule,
      ],
    }).compile();

    expect(moduleRef.get(MailSender, { strict: false })).toBeDefined();
    expect(moduleRef.get(ImageStorage, { strict: false }).publicUrl('a/b')).toBeNull();
    expect(moduleRef.get(AuditLog, { strict: false })).toBeDefined();
    expect(moduleRef.get(IdempotencyStore, { strict: false })).toBeDefined();
  });
});
