import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Prisma, type Voucher as VoucherRow } from '#src/generated/prisma/client.js';
import { NEWEST_FIRST, paginate, type Paginated } from '#src/common/pagination/paginate.js';
import type { PrismaTransactionHost } from '#src/infrastructure/database/cls-transaction-runner.js';
import { VoucherRepository } from '#src/modules/voucher/application/ports/voucher.repository.js';
import { voucherStatusWhere } from '#src/modules/voucher/infrastructure/voucher-status-where.js';
import type {
  NewVoucher,
  Voucher,
  VoucherBuyer,
  VoucherChanges,
  VoucherListQuery,
} from '#src/modules/voucher/domain/voucher.model.js';

@Injectable()
export class PrismaVoucherRepository extends VoucherRepository {
  constructor(@Inject(TransactionHost) private readonly txHost: PrismaTransactionHost) {
    super();
  }

  async findPage({ page, limit, q, status }: VoucherListQuery, now: Date): Promise<Paginated<Voucher>> {
    const { voucher } = this.txHost.tx;
    const where: Prisma.VoucherWhereInput = {
      ...(q ? { code: { contains: escapeLike(q.toUpperCase()) } } : {}),
      ...(status ? voucherStatusWhere(status, now, voucher.fields.totalLimit) : {}),
    };
    const result = await paginate(
      page,
      limit,
      (args) => voucher.findMany({ where, orderBy: [...NEWEST_FIRST], ...args }),
      () => voucher.count({ where }),
    );
    return { ...result, data: result.data.map(toModel) };
  }

  async findById(id: string): Promise<Voucher | null> {
    return toNullableModel(await this.txHost.tx.voucher.findUnique({ where: { id } }));
  }

  async findByCode(code: string, options?: { lockForUpdate?: boolean }): Promise<Voucher | null> {
    const { tx } = this.txHost;
    if (options?.lockForUpdate) {
      if (!this.txHost.isTransactionActive()) {
        throw new Error('lockForUpdate requires an active transaction: call it inside TransactionRunner.run()');
      }
      await tx.$queryRaw`SELECT id FROM vouchers WHERE code = ${code} FOR UPDATE`;
    }
    return toNullableModel(await tx.voucher.findUnique({ where: { code } }));
  }

  async lockById(id: string): Promise<Voucher | null> {
    const { tx } = this.txHost;
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM vouchers WHERE id = ${id}::uuid FOR UPDATE`;
    if (rows.length === 0) return null;
    return toModel(await tx.voucher.findUniqueOrThrow({ where: { id } }));
  }

  async create(voucher: NewVoucher): Promise<Voucher | null> {
    try {
      const created = await this.txHost.tx.voucher.create({
        data: {
          ...voucher,
          value: BigInt(voucher.value),
          maxDiscount: toBigInt(voucher.maxDiscount),
          minSubtotal: BigInt(voucher.minSubtotal),
        },
      });
      return toModel(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
      throw error;
    }
  }

  async update(id: string, changes: VoucherChanges): Promise<Voucher> {
    const updated = await this.txHost.tx.voucher.update({
      where: { id },
      data: {
        type: changes.type ?? undefined,
        value: changes.value == null ? undefined : BigInt(changes.value),
        maxDiscount: changes.maxDiscount === undefined ? undefined : toBigInt(changes.maxDiscount),
        minSubtotal: changes.minSubtotal == null ? undefined : BigInt(changes.minSubtotal),
        totalLimit: changes.totalLimit,
        perBuyerLimit: changes.perBuyerLimit,
        startsAt: changes.startsAt ?? undefined,
        endsAt: changes.endsAt ?? undefined,
        isActive: changes.isActive ?? undefined,
      },
    });
    return toModel(updated);
  }

  async delete(id: string): Promise<void> {
    await this.txHost.tx.voucher.delete({ where: { id } });
  }

  countUsages(voucherId: string, buyer: VoucherBuyer): Promise<number> {
    return this.txHost.tx.voucherUsage.count({
      where: {
        voucherId,
        OR: [{ phone: buyer.phone }, ...(buyer.userId ? [{ userId: buyer.userId }] : [])],
      },
    });
  }

  async incrementUsedCount(voucherId: string): Promise<void> {
    await this.txHost.tx.voucher.update({ where: { id: voucherId }, data: { usedCount: { increment: 1 } } });
  }

  async addUsage(usage: { voucherId: string; orderId: string; buyer: VoucherBuyer; discount: number }): Promise<void> {
    await this.txHost.tx.voucherUsage.create({
      data: {
        voucherId: usage.voucherId,
        orderId: usage.orderId,
        userId: usage.buyer.userId,
        phone: usage.buyer.phone,
        discount: BigInt(usage.discount),
      },
    });
  }
}

/** `%`, `_` trong từ khoá là ký tự thường (`_` hợp lệ trong mã). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function toBigInt(value: number | null): bigint | null {
  return value === null ? null : BigInt(value);
}

function toNullableModel(row: VoucherRow | null): Voucher | null {
  return row ? toModel(row) : null;
}

function toModel(row: VoucherRow): Voucher {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: Number(row.value),
    maxDiscount: row.maxDiscount === null ? null : Number(row.maxDiscount),
    minSubtotal: Number(row.minSubtotal),
    totalLimit: row.totalLimit,
    perBuyerLimit: row.perBuyerLimit,
    usedCount: row.usedCount,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
