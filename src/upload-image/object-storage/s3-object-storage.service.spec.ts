import { describe, expect, it } from 'vitest';
import { S3ObjectStorageService } from '@src/upload-image/object-storage/s3-object-storage.service.js';
import { MAX_IMAGE_SIZE_BYTES, PRESIGNED_URL_EXPIRY_SECONDS } from '@src/upload-image/upload-image.constants.js';

function decodePolicy(fields: Record<string, string>): { conditions: unknown[]; expiration: string } {
  return JSON.parse(Buffer.from(fields.Policy, 'base64').toString('utf-8'));
}

describe('S3ObjectStorageService', () => {
  const service = new S3ObjectStorageService({
    endpoint: 'http://localhost:9000',
    bucket: 'media',
    region: 'us-east-1',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
  });

  it('returns one presigned target per requested file, with a unique key each', async () => {
    const targets = await service.presignBatch('tmp/product-image/', [
      { filename: 'a.jpg', contentType: 'image/jpeg' },
      { filename: 'b.png', contentType: 'image/png' },
    ]);

    expect(targets).toHaveLength(2);
    expect(targets[0].key).not.toBe(targets[1].key);
    expect(targets[0].uploadUrl).toContain('media');
  });

  it('places every generated key under the requested prefix, keeping the file extension', async () => {
    const [target] = await service.presignBatch('tmp/product-image/', [
      { filename: 'a.png', contentType: 'image/png' },
    ]);

    expect(target.key).toMatch(/^tmp\/product-image\/[0-9a-f-]{36}\.png$/);
  });

  it('embeds a content-length-range condition from 1 byte up to MAX_IMAGE_SIZE_BYTES', async () => {
    const [target] = await service.presignBatch('tmp/product-image/', [
      { filename: 'a.jpg', contentType: 'image/jpeg' },
    ]);
    const policy = decodePolicy(target.fields);

    expect(policy.conditions).toContainEqual(['content-length-range', 1, MAX_IMAGE_SIZE_BYTES]);
  });

  it('restricts Content-Type to the requested (allowed) mime type', async () => {
    const [target] = await service.presignBatch('tmp/product-image/', [
      { filename: 'a.jpg', contentType: 'image/jpeg' },
    ]);
    const policy = decodePolicy(target.fields);

    expect(policy.conditions).toContainEqual(['eq', '$Content-Type', 'image/jpeg']);
  });

  it('expires roughly PRESIGNED_URL_EXPIRY_SECONDS from now', async () => {
    const before = Date.now();
    const [target] = await service.presignBatch('tmp/product-image/', [
      { filename: 'a.jpg', contentType: 'image/jpeg' },
    ]);
    const policy = decodePolicy(target.fields);
    const expiresAt = new Date(policy.expiration).getTime();

    expect(expiresAt).toBeGreaterThan(before + (PRESIGNED_URL_EXPIRY_SECONDS - 5) * 1000);
    expect(expiresAt).toBeLessThan(before + (PRESIGNED_URL_EXPIRY_SECONDS + 30) * 1000);
  });

  it('derives the key extension from contentType, ignoring a hostile filename', async () => {
    const [target] = await service.presignBatch('tmp/product-image/', [
      { filename: 'x./a/cover', contentType: 'image/png' },
    ]);

    expect(target.key).toMatch(/^tmp\/product-image\/[0-9a-f-]{36}\.png$/);
  });

  it('round-trips key -> publicUrl -> keyFromUrl', () => {
    const key = 'products/p1/abc-123.jpg';
    expect(service.keyFromUrl(service.publicUrl(key))).toBe(key);
  });

  it('resolves the key from the URL path, so URLs stored under an older endpoint still map to their key', () => {
    expect(service.keyFromUrl('https://old-host.example.com/media/products/p1/abc.jpg')).toBe('products/p1/abc.jpg');
  });

  it('throws on a URL that is not an object URL of the bucket', () => {
    expect(() => service.keyFromUrl('https://cdn.example.com/other/abc.jpg')).toThrow(/not an object URL/);
  });

  describe('with a publicEndpoint distinct from the internal endpoint', () => {
    const dockerService = new S3ObjectStorageService({
      endpoint: 'http://minio:9000',
      publicEndpoint: 'http://localhost:9000/',
      bucket: 'media',
      region: 'us-east-1',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    });

    it('points presigned upload URLs at the public endpoint', async () => {
      const [target] = await dockerService.presignBatch('tmp/product-image/', [
        { filename: 'a.jpg', contentType: 'image/jpeg' },
      ]);

      expect(target.uploadUrl.startsWith('http://localhost:9000/media')).toBe(true);
    });

    it('builds public object URLs from the public endpoint', () => {
      expect(dockerService.publicUrl('products/p1/a.jpg')).toBe('http://localhost:9000/media/products/p1/a.jpg');
    });
  });
});
