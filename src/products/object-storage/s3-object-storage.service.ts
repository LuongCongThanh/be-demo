import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { ObjectStorageService, PresignedUploadTarget } from './object-storage.service.js';
import { MAX_IMAGE_SIZE_BYTES, PRESIGNED_URL_EXPIRY_SECONDS } from './allowed-image-content-type.js';

export interface S3ObjectStorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

// Implementation thật, dùng chung 1 S3 client SDK cho cả MinIO (local dev) và
// S3 thật (production) — chỉ khác endpoint/credentials qua config, không viết
// code riêng cho từng provider (xem docs/superpowers/specs
// 2026-09-18-product-images-object-storage-design.md, mục 4.1).
export class S3ObjectStorageService implements ObjectStorageService {
  private readonly client: S3Client;

  constructor(private readonly config: S3ObjectStorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: true,
    });
  }

  async presignBatch(files: { filename: string; contentType: string }[]): Promise<PresignedUploadTarget[]> {
    return Promise.all(
      files.map(async ({ filename, contentType }) => {
        const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
        const key = `products/uploads/${randomUUID()}${extension}`;

        const { url, fields } = await createPresignedPost(this.client, {
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

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  publicUrl(key: string): string {
    return `${this.config.endpoint}/${this.config.bucket}/${key}`;
  }

  keyFromUrl(url: string): string {
    return url.replace(`${this.config.endpoint}/${this.config.bucket}/`, '');
  }
}
