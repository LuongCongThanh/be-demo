import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/strategies/jwt.strategy.js';
import { OBJECT_STORAGE_SERVICE } from './object-storage/object-storage.service.js';
import type { ObjectStorageService, PresignedUploadTarget } from './object-storage/object-storage.service.js';
import { PresignUploadImagesDto } from './dto/presign-upload-images.dto.js';
import { IMAGE_EXTENSION_BY_CONTENT_TYPE } from './object-storage/allowed-image-content-type.js';
import { UPLOAD_PURPOSE_POLICIES } from './upload-purpose.js';
import type { UploadPurpose } from './upload-purpose.js';

// Phần tên sau prefix của Pending Upload: 1 segment, không `/` hay `..`, đuôi
// là 1 trong các ext do presign sinh ra. Presign đã tự sinh đúng format này —
// check lại ở đây vì key là input từ client, promote() dựa vào nó để đặt tên
// object đích.
const PENDING_OBJECT_NAME = new RegExp(
  `^[A-Za-z0-9-]+\\.(${Object.values(IMAGE_EXTENSION_BY_CONTENT_TYPE).join('|')})$`,
);

// Dùng chung cho mọi module cần ảnh: presign Pending Upload, rồi khi module
// khác gắn ảnh thì xác minh key (prefix + HEAD) và chuyển object từ `tmp/`
// sang prefix chính của nó (docs/adr/0010). Module này không biết gì về
// Product — caller tự quyết định prefix đích và lưu URL vào bảng của mình.
@Injectable()
export class UploadImageService {
  private readonly logger = new Logger(UploadImageService.name);

  constructor(@Inject(OBJECT_STORAGE_SERVICE) private readonly storage: ObjectStorageService) {}

  async presign(user: JwtPayload, dto: PresignUploadImagesDto): Promise<PresignedUploadTarget[]> {
    const policy = UPLOAD_PURPOSE_POLICIES[dto.purpose];
    // Role check theo purpose ở service thay vì @Roles() ở route — 1 route
    // phục vụ nhiều purpose với danh sách role khác nhau.
    if (!policy.allowedRoles.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException(`Not allowed to upload images for ${dto.purpose}`);
    }
    return this.storage.presignBatch(policy.pendingPrefix, dto.files);
  }

  // Chạy TRƯỚC transaction DB của caller — không giữ transaction trong lúc
  // chờ mạng. Key sai prefix/không tồn tại → 400; storage không phản hồi → 503.
  async assertPendingUploads(purpose: UploadPurpose, keys: string[]): Promise<void> {
    const { pendingPrefix } = UPLOAD_PURPOSE_POLICIES[purpose];
    const foreignKeys = keys.filter(
      (key) => !key.startsWith(pendingPrefix) || !PENDING_OBJECT_NAME.test(key.slice(pendingPrefix.length)),
    );
    if (foreignKeys.length > 0) {
      throw new BadRequestException(`Image keys must come from a ${purpose} presign: ${foreignKeys.join(', ')}`);
    }

    const found = await this.withStorage(() => Promise.all(keys.map((key) => this.storage.exists(key))));
    const missingKeys = keys.filter((_, index) => !found[index]);
    if (missingKeys.length > 0) {
      throw new BadRequestException(`Uploaded image not found: ${missingKeys.join(', ')}`);
    }
  }

  // Copy Pending Upload sang `destinationPrefix` (giữ nguyên tên file) và trả
  // URL công khai của bản chính. Bản tạm KHÔNG xoá ở đây — caller xoá bằng
  // discardKeys() sau khi transaction của nó commit, để nếu transaction lỗi
  // client vẫn gửi lại được đúng key cũ.
  async promote(pendingKey: string, destinationPrefix: string): Promise<string> {
    const destinationKey = `${destinationPrefix}${pendingKey.slice(pendingKey.lastIndexOf('/') + 1)}`;
    await this.withStorage(() => this.storage.copy(pendingKey, destinationKey));
    return this.storage.publicUrl(destinationKey);
  }

  async discardUrls(urls: string[]): Promise<void> {
    await this.discardEach(urls, (url) => this.storage.keyFromUrl(url));
  }

  async discardKeys(keys: string[]): Promise<void> {
    await this.discardEach(keys, (key) => key);
  }

  // Best-effort: object rác trên storage không ảnh hưởng nghiệp vụ, không
  // được làm fail request đã commit — nhưng phải log để không nuốt im lặng.
  // Suy key nằm trong try: 1 URL lạ không được chặn việc xoá các URL còn lại.
  private async discardEach(items: string[], toKey: (item: string) => string): Promise<void> {
    await Promise.all(
      items.map(async (item) => {
        try {
          await this.storage.delete(toKey(item));
        } catch (err) {
          this.logger.error(`Failed to delete storage object "${item}"`, err instanceof Error ? err.stack : err);
        }
      }),
    );
  }

  private async withStorage<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      throw new ServiceUnavailableException('Image storage is unavailable, please retry', { cause: err });
    }
  }
}
