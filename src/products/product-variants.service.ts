import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { OptionValue, Prisma, ProductVariant } from '../generated/prisma/client.js';
import { OptionType, VariantStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { composeSku } from './sku.util.js';

// Variant DISCONTINUED không tính: chúng không xoá được (đơn cũ tham chiếu),
// nếu tính thì product sớm muộn không thêm được variant nào nữa.
export const MAX_LIVE_VARIANTS = 50;

export interface VariantEntry {
  id?: string;
  colorId?: string;
  sizeId?: string;
  price?: number;
  status?: VariantStatus;
}

// Kết quả của plan(): mọi thứ cần đọc (Option Value) và mọi quy tắc đã kiểm
// xong, apply() chỉ còn ghi DB bên trong transaction của ProductsService.
export interface VariantSyncPlan {
  creates: { sku: string; colorId?: string; sizeId?: string; price: number }[];
  updates: { id: string; price?: number; status?: VariantStatus }[];
  discontinueIds: string[];
}

type SelectableOptionValue = Pick<OptionValue, 'id' | 'code' | 'type'>;

// Logic variant của Product aggregate, tách khỏi ProductsService cho dễ đọc —
// không có controller riêng: variant chỉ ghi qua `variants[]` của POST/PATCH
// /products (docs/specs/03-products.md).
@Injectable()
export class ProductVariantsService {
  constructor(private readonly prisma: PrismaService) {}

  // `variants` là full desired state: có `id` → sửa, không `id` → tạo mới,
  // variant hiện có vắng mặt → DISCONTINUED (không hard-delete, để không vi
  // phạm FK RESTRICT từ CartItem/OrderItem).
  async plan(
    product: { id: string; code: string },
    existing: ProductVariant[],
    entries: VariantEntry[],
  ): Promise<VariantSyncPlan> {
    const existingById = new Map(existing.map((v) => [v.id, v]));
    const kept = entries.filter((e): e is VariantEntry & { id: string } => Boolean(e.id));
    for (const entry of kept) {
      this.assertKeptEntry(product.id, existingById.get(entry.id), entry);
    }

    const newEntries = entries.filter((e) => !e.id);
    // `price` optional ở DTO vì entry có `id` không cần gửi lại giá — với
    // variant mới thì bắt buộc, thiếu sẽ rơi xuống Prisma thành 500.
    if (newEntries.some((e) => e.price === undefined)) {
      throw new BadRequestException('A new variant requires a price');
    }
    const optionById = await this.selectableOptionValues(newEntries);
    const creates = newEntries.map((e) => ({
      sku: composeSku(
        product.code,
        e.colorId && optionById.get(e.colorId)?.code,
        e.sizeId && optionById.get(e.sizeId)?.code,
      ),
      colorId: e.colorId,
      sizeId: e.sizeId,
      price: e.price!,
    }));
    // SKU cũ (kể cả DISCONTINUED) vẫn giữ unique ở DB — tổ hợp màu + size đã
    // từng dùng không tạo lại được.
    this.assertUniqueSkus(
      existing.map((v) => v.sku),
      creates.map((c) => c.sku),
    );

    const keptIds = new Set(kept.map((e) => e.id));
    const finalStatuses = [
      ...kept.map((e) => e.status ?? existingById.get(e.id)!.status),
      ...creates.map(() => VariantStatus.ACTIVE),
    ];
    this.assertLiveVariants(finalStatuses);

    return {
      creates,
      updates: kept.map(({ id, price, status }) => ({ id, price, status })),
      discontinueIds: existing.filter((v) => !keptIds.has(v.id)).map((v) => v.id),
    };
  }

  async apply(tx: Prisma.TransactionClient, productId: string, plan: VariantSyncPlan): Promise<void> {
    for (const { id, ...fields } of plan.updates) {
      await tx.productVariant.update({ where: { id }, data: fields });
    }
    for (const fields of plan.creates) {
      const created = await tx.productVariant.create({ data: { ...fields, productId } });
      await tx.inventory.create({ data: { variantId: created.id, quantity: 0, reservedQuantity: 0 } });
    }
    if (plan.discontinueIds.length > 0) {
      await tx.productVariant.updateMany({
        where: { productId, id: { in: plan.discontinueIds } },
        data: { status: VariantStatus.DISCONTINUED },
      });
    }
  }

  private assertKeptEntry(
    productId: string,
    variant: ProductVariant | undefined,
    entry: VariantEntry & { id: string },
  ) {
    if (!variant) {
      throw new BadRequestException(`Variant #${entry.id} not found on product #${productId}`);
    }
    // Màu/size định nghĩa variant (docs/adr/0011) — chọn nhầm thì bỏ variant đó
    // khỏi mảng và tạo variant mới.
    if (entry.colorId !== undefined || entry.sizeId !== undefined) {
      throw new BadRequestException(`Color and size of variant #${entry.id} cannot change`);
    }
    if (
      variant.status === VariantStatus.DISCONTINUED &&
      entry.status !== undefined &&
      entry.status !== VariantStatus.DISCONTINUED
    ) {
      throw new BadRequestException(`Variant #${entry.id} is discontinued and cannot return to sale`);
    }
  }

  private assertUniqueSkus(existingSkus: string[], newSkus: string[]) {
    const seen = new Set(existingSkus);
    for (const sku of newSkus) {
      if (seen.has(sku)) {
        throw new ConflictException(`SKU "${sku}" already exists on this product`);
      }
      seen.add(sku);
    }
  }

  private assertLiveVariants(finalStatuses: VariantStatus[]) {
    if (!finalStatuses.includes(VariantStatus.ACTIVE)) {
      throw new BadRequestException(
        'A product must keep at least one ACTIVE variant — set the product status to INACTIVE to take it off sale',
      );
    }
    const live = finalStatuses.filter((status) => status !== VariantStatus.DISCONTINUED).length;
    if (live > MAX_LIVE_VARIANTS) {
      throw new BadRequestException(
        `A product can have at most ${MAX_LIVE_VARIANTS} variants that are not DISCONTINUED`,
      );
    }
  }

  // Chỉ Option Value đang hiện và đúng loại mới chọn được cho variant mới.
  private async selectableOptionValues(entries: VariantEntry[]): Promise<Map<string, SelectableOptionValue>> {
    const wanted = entries.flatMap((e) => [
      ...(e.colorId ? [{ id: e.colorId, type: OptionType.COLOR }] : []),
      ...(e.sizeId ? [{ id: e.sizeId, type: OptionType.SIZE }] : []),
    ]);
    if (wanted.length === 0) {
      return new Map();
    }
    const found = await this.prisma.optionValue.findMany({
      where: { id: { in: [...new Set(wanted.map((w) => w.id))] }, hidden: false },
      select: { id: true, code: true, type: true },
    });
    const byId = new Map(found.map((v) => [v.id, v]));
    const invalid = wanted.filter((w) => byId.get(w.id)?.type !== w.type);
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Option Value not selectable (missing, hidden or wrong type): ${invalid.map((w) => `${w.type} ${w.id}`).join(', ')}`,
      );
    }
    return byId;
  }
}
