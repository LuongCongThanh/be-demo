import { crc32, deflateSync } from 'node:zlib';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { S3ObjectStorageService } from '../src/modules/upload-image/object-storage/s3-object-storage.service.js';

export interface ProductImageSeed {
  productId: string;
  productName: string;
  // Mã màu của variant đầu tiên — quyết định màu ảnh sinh ra.
  colorCode: string;
}

type Rgb = [number, number, number];

const RGB_BY_COLOR_CODE: Record<string, Rgb> = {
  BLK: [40, 40, 40],
  WHT: [236, 236, 236],
  BLU: [38, 84, 160],
  KHK: [195, 176, 145],
  BRN: [110, 72, 44],
};
const FALLBACK_RGB: Rgb = [150, 150, 150];
const IMAGE_SIZE_PX = 600;

// Ảnh thật trên MinIO thay vì URL placeholder bên ngoài: gỡ ảnh qua PATCH
// /products gọi keyFromUrl() — URL ngoài bucket sẽ throw và log lỗi. Key cố
// định `products/<productId>/seed-<n>.png` (không phải `<uuid>.<ext>` như ảnh
// upload thật) để chạy lại seed ghi đè đúng object cũ, không sinh rác.
export async function seedProductImages(prisma: PrismaClient, seeds: ProductImageSeed[]): Promise<void> {
  // Cùng ngoại lệ với ADMIN_BOOTSTRAP_* ở seed.ts: script chạy ngoài Nest DI,
  // đọc process.env trực tiếp.
  const { S3_ENDPOINT, S3_PUBLIC_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error('Missing S3_ENDPOINT / S3_BUCKET / S3_REGION / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY in .env');
  }
  const client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    forcePathStyle: true,
  });
  // Chỉ dùng publicUrl() — URL lưu DB phải khớp đúng định dạng app tự sinh
  // để keyFromUrl() suy ngược được khi xoá ảnh.
  const storage = new S3ObjectStorageService({
    endpoint: S3_ENDPOINT,
    publicEndpoint: S3_PUBLIC_ENDPOINT,
    bucket: S3_BUCKET,
    region: S3_REGION,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  });

  let created = 0;
  for (const seed of seeds) {
    const rgb = RGB_BY_COLOR_CODE[seed.colorCode] ?? FALLBACK_RGB;
    const images = [
      { key: `products/${seed.productId}/seed-1.png`, altText: `${seed.productName} - front`, striped: false },
      { key: `products/${seed.productId}/seed-2.png`, altText: `${seed.productName} - detail`, striped: true },
    ].map((image) => ({ ...image, url: storage.publicUrl(image.key) }));
    const seedUrls = new Set(images.map((image) => image.url));

    const existing = await prisma.productImage.findMany({ where: { productId: seed.productId } });
    // Product đã có ảnh do người dùng gắn qua API → không đụng vào.
    if (existing.some((image) => !seedUrls.has(image.url))) {
      continue;
    }
    // Ghi lại cả object của row seed đã có: volume MinIO bị xoá thì DB vẫn
    // còn URL nhưng ảnh 404 — chạy lại seed là sửa được.
    const existingUrls = new Set(existing.map((image) => image.url));
    const toUpload = existing.length === 0 ? images : images.filter((image) => existingUrls.has(image.url));
    try {
      for (const image of toUpload) {
        await client.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: image.key,
            Body: renderPng(rgb, image.striped),
            ContentType: 'image/png',
          }),
        );
      }
    } catch (err) {
      const hint = 'is MinIO running (docker compose up -d minio minio-init)?';
      throw new Error(`Failed to upload seed images to ${S3_ENDPOINT} — ${hint}`, { cause: err });
    }

    if (existing.length === 0) {
      await prisma.productImage.createMany({
        data: images.map((image, sortOrder) => ({
          productId: seed.productId,
          url: image.url,
          altText: image.altText,
          sortOrder,
        })),
      });
      created += images.length;
    }
  }

  console.log(`Seeded product images: ${created} created.`);
}

// PNG RGB 8-bit tối giản bằng zlib có sẵn của Node — tránh thêm dependency
// xử lý ảnh chỉ để sinh vài ảnh mẫu. Ảnh sọc chéo để ảnh thứ 2 khác ảnh cover.
function renderPng([r, g, b]: Rgb, striped: boolean): Buffer {
  const tint: Rgb = [r, g, b].map((channel) => Math.round(channel + (255 - channel) * 0.35)) as Rgb;
  const rowLength = 1 + IMAGE_SIZE_PX * 3;
  const raw = Buffer.alloc(rowLength * IMAGE_SIZE_PX);
  for (let y = 0; y < IMAGE_SIZE_PX; y++) {
    // Byte đầu mỗi dòng là filter type, 0 = None.
    for (let x = 0; x < IMAGE_SIZE_PX; x++) {
      const color = striped && Math.floor((x + y) / 40) % 2 === 1 ? tint : [r, g, b];
      raw.set(color, y * rowLength + 1 + x * 3);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(IMAGE_SIZE_PX, 0);
  header.writeUInt32BE(IMAGE_SIZE_PX, 4);
  header.set([8, 2, 0, 0, 0], 8); // bit depth 8, color type RGB, compression/filter/interlace mặc định

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}
