import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma, ProductVariant } from '../generated/prisma/client.js';
import { VariantStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { composeSku } from './sku.util.js';

export interface VariantEntry {
  id?: string;
  colorId?: string;
  sizeId?: string;
  price?: number;
  status?: VariantStatus;
}

// Kết quả của plan(): mọi thứ cần đọc (Option Value) đã xong, apply() chỉ
// còn ghi DB bên trong transaction của ProductsService.
export interface VariantSyncPlan {
  creates: { sku: string; colorId?: string; sizeId?: string; price: number }[];
  updates: { id: string; price?: number; status?: VariantStatus }[];
  discontinueIds: string[];
}

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
    const existingIds = new Set(existing.map((v) => v.id));
    const foreign = entries.find((e) => e.id && !existingIds.has(e.id));
    if (foreign) {
      throw new BadRequestException(`Variant #${foreign.id} not found on product #${product.id}`);
    }

    const newEntries = entries.filter((e) => !e.id);
    const codeById = await this.optionValueCodes(newEntries);
    const creates = newEntries.map((e) => ({
      sku: composeSku(product.code, e.colorId && codeById.get(e.colorId), e.sizeId && codeById.get(e.sizeId)),
      colorId: e.colorId,
      sizeId: e.sizeId,
      price: e.price as number,
    }));

    const keptIds = new Set(entries.filter((e) => e.id).map((e) => e.id));
    return {
      creates,
      updates: entries
        .filter((e): e is VariantEntry & { id: string } => Boolean(e.id))
        .map(({ id, price, status }) => ({ id, price, status })),
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

  private async optionValueCodes(entries: VariantEntry[]): Promise<Map<string, string>> {
    const ids = [...new Set(entries.flatMap((e) => [e.colorId, e.sizeId]).filter((id): id is string => Boolean(id)))];
    const found = await this.prisma.optionValue.findMany({
      where: { id: { in: ids } },
      select: { id: true, code: true },
    });
    const codeById = new Map(found.map((v) => [v.id, v.code]));
    const missing = ids.filter((id) => !codeById.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Option Value not found: ${missing.join(', ')}`);
    }
    return codeById;
  }
}
