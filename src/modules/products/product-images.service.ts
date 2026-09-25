import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { UploadImageService } from '../upload-image/upload-image.service.js';

// Hình dạng thô từ DTO (class-validator không diễn đạt gọn được "xor");
// plan() kiểm rồi thu hẹp về ProductImageEntry.
export interface ProductImageEntryInput {
  id?: string;
  key?: string;
  altText?: string;
}

type KeptImage = { id: string; altText?: string };
type NewImage = { key: string; altText?: string };
type ProductImageEntry = KeptImage | NewImage;

const isKept = (entry: ProductImageEntry): entry is KeptImage => 'id' in entry;

// Kết quả của plan(): mọi thứ cần đọc/gọi mạng đã xong (HEAD, copy), chỉ còn
// ghi DB — apply() chạy bên trong transaction của ProductsService.
export interface ProductImageSyncPlan {
  // Đúng thứ tự mong muốn — index chính là sort_order.
  rows: ({ id: string; altText?: string } | { url: string; altText?: string })[];
  removedIds: string[];
  removedUrls: string[];
  promotedUrls: string[];
  pendingKeys: string[];
}

// Logic ảnh của Product aggregate, tách khỏi ProductsService cho dễ đọc —
// không có controller riêng: ảnh chỉ ghi qua `images[]` của POST/PATCH
// /products (docs/specs/03-products.md, mục "Product Images contract").
@Injectable()
export class ProductImagesService {
  constructor(private readonly uploadImageService: UploadImageService) {}

  async plan(
    productId: string,
    existing: { id: string; url: string }[],
    input: ProductImageEntryInput[],
  ): Promise<ProductImageSyncPlan> {
    const entries = this.toEntries(input);
    const kept = entries.filter(isKept);

    const existingIds = new Set(existing.map((image) => image.id));
    const foreignIds = kept.filter((e) => !existingIds.has(e.id)).map((e) => e.id);
    if (foreignIds.length > 0) {
      throw new BadRequestException(`Image not found on product #${productId}: ${foreignIds.join(', ')}`);
    }

    const pendingKeys = entries.filter((e): e is NewImage => !isKept(e)).map((e) => e.key);
    await this.uploadImageService.assertPendingUploads('PRODUCT_IMAGE', pendingKeys);
    const promotedUrls = await this.promoteAll(productId, pendingKeys);

    const urlByKey = new Map(pendingKeys.map((key, index) => [key, promotedUrls[index]]));
    const rows = entries.map((e) =>
      isKept(e) ? { id: e.id, altText: e.altText } : { url: urlByKey.get(e.key)!, altText: e.altText },
    );

    const keptIds = new Set(kept.map((e) => e.id));
    const removed = existing.filter((image) => !keptIds.has(image.id));

    return {
      rows,
      removedIds: removed.map((image) => image.id),
      removedUrls: removed.map((image) => image.url),
      promotedUrls,
      pendingKeys,
    };
  }

  async apply(tx: Prisma.TransactionClient, productId: string, plan: ProductImageSyncPlan): Promise<void> {
    if (plan.removedIds.length > 0) {
      await tx.productImage.deleteMany({ where: { productId, id: { in: plan.removedIds } } });
    }
    for (const [sortOrder, row] of plan.rows.entries()) {
      if ('id' in row) {
        // altText vắng mặt = giữ nguyên (không xoá mô tả cũ chỉ vì client
        // gửi lại `{ id }` để giữ ảnh).
        // plan() đọc ảnh hiện có ngoài transaction — request khác có thể đã
        // gỡ ảnh này trong lúc đó. updateMany + đếm để trả 409 rõ nghĩa thay
        // vì P2025 (404 "Record không tồn tại") khó hiểu.
        const { count } = await tx.productImage.updateMany({
          where: { id: row.id, productId },
          data: { sortOrder, ...(row.altText !== undefined && { altText: row.altText }) },
        });
        if (count === 0) {
          throw new ConflictException(`Image #${row.id} was removed by a concurrent update, please retry`);
        }
      } else {
        await tx.productImage.create({ data: { productId, url: row.url, altText: row.altText, sortOrder } });
      }
    }
  }

  // Bọc transaction của caller để dọn storage đúng theo kết quả: lỗi → xoá
  // các bản copy vừa tạo (Pending Upload vẫn còn, client gửi lại được);
  // thành công → xoá object của ảnh bị gỡ + bản tạm đã copy xong. Cả hai đều
  // best-effort, không làm đổi kết quả request.
  async commit<T>(plan: ProductImageSyncPlan | undefined, write: () => Promise<T>): Promise<T> {
    if (!plan) {
      return write();
    }
    let result: T;
    try {
      result = await write();
    } catch (err) {
      await this.uploadImageService.discardUrls(plan.promotedUrls);
      throw err;
    }
    await this.uploadImageService.discardUrls(plan.removedUrls);
    await this.uploadImageService.discardKeys(plan.pendingKeys);
    return result;
  }

  async discardUrls(urls: string[]): Promise<void> {
    await this.uploadImageService.discardUrls(urls);
  }

  private toEntries(input: ProductImageEntryInput[]): ProductImageEntry[] {
    const entries = input.map(({ id, key, altText }): ProductImageEntry => {
      if (Boolean(id) === Boolean(key)) {
        throw new BadRequestException('Each image entry must have exactly one of "id" or "key"');
      }
      return id ? { id, altText } : { key: key!, altText };
    });
    const refs = entries.map((e) => (isKept(e) ? `id:${e.id}` : `key:${e.key}`));
    if (new Set(refs).size !== refs.length) {
      throw new BadRequestException('Duplicate image entries are not allowed');
    }
    return entries;
  }

  private async promoteAll(productId: string, pendingKeys: string[]): Promise<string[]> {
    const results = await Promise.allSettled(
      pendingKeys.map((key) => this.uploadImageService.promote(key, `products/${productId}/`)),
    );
    const promoted = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failure) {
      await this.uploadImageService.discardUrls(promoted);
      throw failure.reason;
    }
    return promoted;
  }
}
