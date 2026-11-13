import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Voucher } from '#src/generated/prisma/client.js';
import { paginate, NEWEST_FIRST, type Paginated } from '#src/common/pagination/paginate.js';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { CreateVoucherDto } from '#src/modules/voucher/dto/create-voucher.dto.js';
import { ListVouchersQueryDto } from '#src/modules/voucher/dto/list-vouchers-query.dto.js';
import { UpdateVoucherDto } from '#src/modules/voucher/dto/update-voucher.dto.js';
import { VoucherResponseDto } from '#src/modules/voucher/dto/voucher-response.dto.js';
import { voucherStatus, voucherStatusWhere } from '#src/modules/voucher/voucher-status.js';

/** Trường còn sửa được khi Voucher đã có lượt dùng. */
const EDITABLE_AFTER_USE = new Set<keyof UpdateVoucherDto>(['endsAt', 'totalLimit', 'perBuyerLimit', 'isActive']);
/** Trường không nhận `null` (cột NOT NULL). */
const NOT_NULL = ['type', 'value', 'minSubtotal', 'startsAt', 'endsAt', 'isActive'] as const;

interface VoucherTerms {
  type: Voucher['type'];
  value: number;
  maxDiscount: number | null;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Voucher phía back-office (US-901). Áp mã, đếm và trả lượt dùng làm ở slice C cùng Đơn hàng.
 * Mã không đổi; Voucher chưa ai dùng sửa và xoá tự do; đã có lượt dùng chỉ đổi thời gian kết thúc,
 * giới hạn lượt và bật/tắt, không xoá được.
 */
@Injectable()
export class AdminVoucherService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll({ page, limit, q, status }: ListVouchersQueryDto): Promise<Paginated<VoucherResponseDto>> {
    const now = new Date();
    const where: Prisma.VoucherWhereInput = {
      ...(q ? { code: { contains: escapeLike(q.toUpperCase()) } } : {}),
      ...(status ? voucherStatusWhere(status, now, this.prisma.voucher.fields.totalLimit) : {}),
    };
    const result = await paginate(
      page,
      limit,
      (args) => this.prisma.voucher.findMany({ where, orderBy: [...NEWEST_FIRST], ...args }),
      () => this.prisma.voucher.count({ where }),
    );
    return { ...result, data: result.data.map((v) => toResponse(v, now)) };
  }

  async findOne(id: string): Promise<VoucherResponseDto> {
    return toResponse(await this.findOrThrow(id), new Date());
  }

  async create(dto: CreateVoucherDto, createdById: string): Promise<VoucherResponseDto> {
    const terms = {
      type: dto.type,
      value: dto.value,
      maxDiscount: dto.maxDiscount ?? null,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
    };
    assertTerms(terms);
    try {
      const created = await this.prisma.voucher.create({
        data: {
          code: dto.code,
          type: dto.type,
          value: BigInt(dto.value),
          maxDiscount: toBigInt(dto.maxDiscount ?? null),
          minSubtotal: BigInt(dto.minSubtotal ?? 0),
          totalLimit: dto.totalLimit ?? null,
          perBuyerLimit: dto.perBuyerLimit ?? null,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          isActive: dto.isActive ?? true,
          createdById,
        },
      });
      return toResponse(created, new Date());
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Voucher code "${dto.code}" already exists`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateVoucherDto): Promise<VoucherResponseDto> {
    for (const key of NOT_NULL) {
      if (dto[key] === null) throw new BadRequestException(`${key} cannot be null`);
    }
    // Khoá dòng: lượt dùng (slice C) không được đổi giữa lúc kiểm và lúc ghi.
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await lockVoucher(tx, id);
      const changed = changedFields(current, dto);
      if (changed.length === 0) return current;
      if (current.usedCount > 0) {
        const locked = changed.filter((key) => !EDITABLE_AFTER_USE.has(key));
        if (locked.length > 0) {
          throw new ConflictException(`Voucher already used; these cannot change: ${locked.join(', ')}`);
        }
      }

      const type = dto.type ?? current.type;
      // Đổi sang FIXED mà không gửi maxDiscount: bỏ mức tối đa (chỉ áp cho %).
      const maxDiscount =
        dto.maxDiscount !== undefined ? dto.maxDiscount : type === 'FIXED' ? null : toNumber(current.maxDiscount);
      assertTerms({
        type,
        value: dto.value ?? Number(current.value),
        maxDiscount,
        startsAt: dto.startsAt ?? current.startsAt,
        endsAt: dto.endsAt ?? current.endsAt,
      });

      const totalLimit = dto.totalLimit === undefined ? current.totalLimit : dto.totalLimit;
      if (totalLimit !== null && totalLimit < current.usedCount) {
        throw new BadRequestException(`totalLimit cannot be below the ${current.usedCount} uses already counted`);
      }

      return tx.voucher.update({
        where: { id },
        data: {
          type: dto.type,
          value: dto.value === undefined ? undefined : BigInt(dto.value),
          maxDiscount: toBigInt(maxDiscount),
          minSubtotal: dto.minSubtotal === undefined ? undefined : BigInt(dto.minSubtotal),
          totalLimit: dto.totalLimit,
          perBuyerLimit: dto.perBuyerLimit,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          isActive: dto.isActive,
        },
      });
    });
    return toResponse(updated, new Date());
  }

  /** Chỉ xoá Voucher chưa có lượt dùng; đã dùng thì vô hiệu hoá (BR-VCH-11). */
  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await lockVoucher(tx, id);
      if (current.usedCount > 0) throw new ConflictException('Voucher already used; deactivate it instead');
      await tx.voucher.delete({ where: { id } });
    });
  }

  private async findOrThrow(id: string): Promise<Voucher> {
    const found = await this.prisma.voucher.findUnique({ where: { id } });
    if (!found) throw new NotFoundException(`Voucher #${id} not found`);
    return found;
  }
}

/** Đọc Voucher và khoá dòng tới hết transaction; không có → 404. */
async function lockVoucher(tx: Prisma.TransactionClient, id: string): Promise<Voucher> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM vouchers WHERE id = ${id}::uuid FOR UPDATE`;
  if (rows.length === 0) throw new NotFoundException(`Voucher #${id} not found`);
  return tx.voucher.findUniqueOrThrow({ where: { id } });
}

/** Trường thực sự đổi giá trị: form gửi lại cả object không bị coi là sửa trường đã khoá. */
function changedFields(current: Voucher, dto: UpdateVoucherDto): (keyof UpdateVoucherDto)[] {
  const now: Record<keyof UpdateVoucherDto, unknown> = {
    type: current.type,
    value: Number(current.value),
    maxDiscount: toNumber(current.maxDiscount),
    minSubtotal: Number(current.minSubtotal),
    totalLimit: current.totalLimit,
    perBuyerLimit: current.perBuyerLimit,
    startsAt: current.startsAt.getTime(),
    endsAt: current.endsAt.getTime(),
    isActive: current.isActive,
  };
  return (Object.keys(dto) as (keyof UpdateVoucherDto)[]).filter((key) => {
    const next = dto[key];
    if (next === undefined) return false;
    return (next instanceof Date ? next.getTime() : next) !== now[key];
  });
}

/** `%`, `_` trong từ khoá là ký tự thường (`_` hợp lệ trong mã). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** BR-VCH-03: % trong 1–100, mức tối đa chỉ cho %; thời gian kết thúc sau bắt đầu. */
function assertTerms({ type, value, maxDiscount, startsAt, endsAt }: VoucherTerms): void {
  if (type === 'PERCENT' && value > 100) throw new BadRequestException('A percent voucher value must be 1–100');
  if (type === 'FIXED' && maxDiscount !== null)
    throw new BadRequestException('maxDiscount applies to percent vouchers only');
  if (endsAt <= startsAt) throw new BadRequestException('endsAt must be after startsAt');
}

function toBigInt(value: number | null): bigint | null {
  return value === null ? null : BigInt(value);
}

function toNumber(value: bigint | null): number | null {
  return value === null ? null : Number(value);
}

function toResponse(voucher: Voucher, at: Date): VoucherResponseDto {
  return {
    id: voucher.id,
    code: voucher.code,
    type: voucher.type,
    value: Number(voucher.value),
    maxDiscount: toNumber(voucher.maxDiscount),
    minSubtotal: Number(voucher.minSubtotal),
    totalLimit: voucher.totalLimit,
    perBuyerLimit: voucher.perBuyerLimit,
    usedCount: voucher.usedCount,
    startsAt: voucher.startsAt,
    endsAt: voucher.endsAt,
    isActive: voucher.isActive,
    status: voucherStatus(voucher, at),
    createdAt: voucher.createdAt,
    updatedAt: voucher.updatedAt,
  };
}
