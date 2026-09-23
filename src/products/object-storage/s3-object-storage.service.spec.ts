import { describe, expect, it } from 'vitest';
import { S3ObjectStorageService } from './s3-object-storage.service.js';
import { MAX_IMAGE_SIZE_BYTES, PRESIGNED_URL_EXPIRY_SECONDS } from './allowed-image-content-type.js';

function decodePolicy(fields: Record<string, string>): { conditions: unknown[]; expiration: string } {
  return JSON.parse(Buffer.from(fields.Policy, 'base64').toString('utf-8'));
}

describe('S3ObjectStorageService', () => {
  const service = new S3ObjectStorageService({
    endpoint: 'http://localhost:9000',
    bucket: 'product-images',
    region: 'us-east-1',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
  });

  it('returns one presigned target per requested file, with a unique key each', async () => {
    const targets = await service.presignBatch([
      { filename: 'a.jpg', contentType: 'image/jpeg' },
      { filename: 'b.png', contentType: 'image/png' },
    ]);

    expect(targets).toHaveLength(2);
    expect(targets[0].key).not.toBe(targets[1].key);
    expect(targets[0].uploadUrl).toContain('product-images');
  });

  it('embeds a content-length-range condition capping the upload at MAX_IMAGE_SIZE_BYTES', async () => {
    const [target] = await service.presignBatch([{ filename: 'a.jpg', contentType: 'image/jpeg' }]);
    const policy = decodePolicy(target.fields);

    expect(policy.conditions).toContainEqual(['content-length-range', 0, MAX_IMAGE_SIZE_BYTES]);
  });

  it('restricts Content-Type to the requested (allowed) mime type', async () => {
    const [target] = await service.presignBatch([{ filename: 'a.jpg', contentType: 'image/jpeg' }]);
    const policy = decodePolicy(target.fields);

    expect(policy.conditions).toContainEqual(['eq', '$Content-Type', 'image/jpeg']);
  });

  it('expires roughly PRESIGNED_URL_EXPIRY_SECONDS from now', async () => {
    const before = Date.now();
    const [target] = await service.presignBatch([{ filename: 'a.jpg', contentType: 'image/jpeg' }]);
    const policy = decodePolicy(target.fields);
    const expiresAt = new Date(policy.expiration).getTime();

    expect(expiresAt).toBeGreaterThan(before + (PRESIGNED_URL_EXPIRY_SECONDS - 5) * 1000);
    expect(expiresAt).toBeLessThan(before + (PRESIGNED_URL_EXPIRY_SECONDS + 30) * 1000);
  });

  it('round-trips key -> publicUrl -> keyFromUrl', () => {
    const key = 'products/uploads/abc-123.jpg';
    expect(service.keyFromUrl(service.publicUrl(key))).toBe(key);
  });
});
