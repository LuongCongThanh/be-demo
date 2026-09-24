import { randomUUID } from 'node:crypto';
import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, NotFound, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { ObjectStorageService, PresignFileRequest, PresignedUploadTarget } from './object-storage.service.js';
import {
  IMAGE_EXTENSION_BY_CONTENT_TYPE,
  MAX_IMAGE_SIZE_BYTES,
  PRESIGNED_URL_EXPIRY_SECONDS,
} from './allowed-image-content-type.js';

export interface S3ObjectStorageConfig {
  endpoint: string;
  // Endpoint mà client (trình duyệt) truy cập được — dùng cho uploadUrl của
  // presign và URL công khai lưu DB. Khác `endpoint` khi backend gọi storage
  // qua mạng nội bộ (vd. `http://minio:9000` trong docker-compose) còn client
  // đi qua `http://localhost:9000`. Bỏ trống = dùng `endpoint`.
  publicEndpoint?: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

// Implementation thật, dùng chung 1 S3 client SDK cho cả MinIO (local dev) và
// S3 thật (production) — chỉ khác endpoint/credentials qua config, không viết
// code riêng cho từng provider.
export class S3ObjectStorageService implements ObjectStorageService {
  private readonly client: S3Client;
  // Client riêng chỉ để ký presigned POST: chữ ký policy không phụ thuộc
  // host, nên URL trả cho client có thể trỏ public endpoint dù backend gọi
  // storage qua endpoint nội bộ.
  private readonly presignClient: S3Client;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: S3ObjectStorageConfig) {
    const publicEndpoint = (config.publicEndpoint || config.endpoint).replace(/\/+$/, '');
    this.client = this.createClient(config.endpoint);
    this.presignClient = this.createClient(publicEndpoint);
    this.publicBaseUrl = `${publicEndpoint}/${config.bucket}/`;
  }

  async presignBatch(keyPrefix: string, files: PresignFileRequest[]): Promise<PresignedUploadTarget[]> {
    return Promise.all(
      files.map(async ({ contentType }) => {
        const key = `${keyPrefix}${randomUUID()}.${IMAGE_EXTENSION_BY_CONTENT_TYPE[contentType]}`;

        const { url, fields } = await createPresignedPost(this.presignClient, {
          Bucket: this.config.bucket,
          Key: key,
          Conditions: [
            ['content-length-range', 0, MAX_IMAGE_SIZE_BYTES],
            ['eq', '$Content-Type', contentType],
          ],
          Fields: { 'Content-Type': contentType },
          Expires: PRESIGNED_URL_EXPIRY_SECONDS,
        });

        return { key, uploadUrl: url, fields };
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch (err) {
      // HEAD không có body nên SDK chỉ map được 404 thành `NotFound` — mọi
      // lỗi khác (403, mạng, timeout) để nổi lên cho caller trả 503.
      if (err instanceof NotFound) {
        return false;
      }
      throw err;
    }
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.config.bucket,
        CopySource: `${this.config.bucket}/${sourceKey}`,
        Key: destinationKey,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}${key}`;
  }

  // Suy key từ path `/<bucket>/<key>` thay vì replace chuỗi theo endpoint
  // hiện tại — URL cũ trong DB vẫn ra đúng key khi đổi host/endpoint.
  keyFromUrl(url: string): string {
    const bucketPath = `/${this.config.bucket}/`;
    const { pathname } = new URL(url);
    const bucketIndex = pathname.indexOf(bucketPath);
    if (bucketIndex === -1) {
      throw new Error(`URL "${url}" is not an object URL of bucket "${this.config.bucket}"`);
    }
    return decodeURIComponent(pathname.slice(bucketIndex + bucketPath.length));
  }

  private createClient(endpoint: string): S3Client {
    return new S3Client({
      endpoint,
      region: this.config.region,
      credentials: { accessKeyId: this.config.accessKeyId, secretAccessKey: this.config.secretAccessKey },
      forcePathStyle: true,
    });
  }
}
