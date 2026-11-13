import { createHash } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Bộ tham số để trình duyệt gửi form POST thẳng lên kho ảnh (cùng dạng presigned POST của S3). */
export interface SignedUpload {
  uploadUrl: string;
  fields: Record<string, string>;
  expiresAt: Date;
}

export interface StoredImage {
  bytes: number;
  /** Định dạng do Cloudinary nhận diện từ nội dung file: `jpg`, `png`, `webp`, … */
  format: string;
}

interface Credentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

// Cloudinary nhận chữ ký có `timestamp` trong vòng 1 giờ; API không rút ngắn được.
const SIGNATURE_TTL_SECONDS = 3600;

/**
 * Adapter kho ảnh (một adapter → inject trực tiếp, không interface). API ký
 * tham số upload, trình duyệt up thẳng lên Cloudinary, API không nhận byte
 * ảnh. Đổi sang kho chuẩn S3 sau này chỉ thay class này: `SignedUpload` cùng
 * dạng `url + fields` của presigned POST.
 *
 * Thiếu CLOUDINARY_* thì app vẫn chạy (dev, CI): upload/gắn ảnh trả 503 và
 * `publicUrl` trả null.
 */
@Injectable()
export class CloudinaryClient {
  private readonly logger = new Logger(CloudinaryClient.name);

  constructor(private readonly config: ConfigService) {}

  publicUrl(storageKey: string): string | null {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    return cloudName ? `https://res.cloudinary.com/${cloudName}/image/upload/${encodeKey(storageKey)}` : null;
  }

  /** `overwrite=false`: chữ ký còn hạn cũng không ghi đè được ảnh đã kiểm ở bước gắn. */
  signUpload(storageKey: string, allowedFormats: readonly string[]): SignedUpload {
    const { cloudName, apiKey, apiSecret } = this.credentials();
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      allowed_formats: allowedFormats.join(','),
      overwrite: 'false',
      public_id: storageKey,
      timestamp: String(timestamp),
    };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      fields: { ...params, api_key: apiKey, signature: sign(params, apiSecret) },
      expiresAt: new Date((timestamp + SIGNATURE_TTL_SECONDS) * 1000),
    };
  }

  /** null khi chưa có file với key này. */
  async findImage(storageKey: string): Promise<StoredImage | null> {
    const { cloudName, apiKey, apiSecret } = this.credentials();
    const res = await this.call(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${encodeKey(storageKey)}`,
      { headers: { authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` } },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw this.unavailable(`lookup ${storageKey}`, res.status);
    const body = (await res.json()) as StoredImage;
    return { bytes: body.bytes, format: body.format };
  }

  async destroy(storageKey: string): Promise<void> {
    const { cloudName, apiKey, apiSecret } = this.credentials();
    const params = { invalidate: 'true', public_id: storageKey, timestamp: String(Math.floor(Date.now() / 1000)) };
    const res = await this.call(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: new URLSearchParams({ ...params, api_key: apiKey, signature: sign(params, apiSecret) }),
    });
    if (!res.ok) throw this.unavailable(`destroy ${storageKey}`, res.status);
  }

  private credentials(): Credentials {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException('Image storage is not configured');
    }
    return { cloudName, apiKey, apiSecret };
  }

  private async call(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    } catch (err) {
      this.logger.error(`Cloudinary request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Image storage is unavailable');
    }
  }

  private unavailable(action: string, status: number): ServiceUnavailableException {
    this.logger.error(`Cloudinary ${action} answered HTTP ${status}`);
    return new ServiceUnavailableException('Image storage is unavailable');
  }
}

// https://cloudinary.com/documentation/authentication_signatures: tham số sắp theo tên, nối `k=v&…`, thêm secret, SHA-1.
function sign(params: Record<string, string>, apiSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1')
    .update(payload + apiSecret)
    .digest('hex');
}

function encodeKey(storageKey: string): string {
  return storageKey.split('/').map(encodeURIComponent).join('/');
}
