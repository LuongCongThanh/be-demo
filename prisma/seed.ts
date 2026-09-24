import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import slugify from 'slugify';
import { composeSku } from '../src/products/sku.util.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // Idempotent — upsert instead of create, so re-running this script (every
  // fresh dev machine, every CI run, every deploy) never creates duplicate
  // roles.
  const adminRole = await prisma.role.upsert({
    where: { name: 'MASTER_ADMIN' },
    update: {},
    create: { name: 'MASTER_ADMIN' },
  });
  await prisma.role.upsert({
    where: { name: 'CUSTOMER' },
    update: {},
    create: { name: 'CUSTOMER' },
  });

  // Deliberate exception: this script runs standalone, outside the Nest DI
  // container (no ConfigService to inject), so it's allowed to read
  // process.env directly — the one exception to "config only via
  // ConfigService" in this codebase.
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    throw new Error('Missing ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD in .env');
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (existingAdmin) {
    console.log(`Admin ${email} already exists, skipping.`);
  } else {
    const passwordHash = await argon2.hash(password);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        // fullName/phone không có ý nghĩa thật với tài khoản bootstrap này
        // (không phải khách hàng đăng ký qua form) — điền placeholder cố định
        // để thoả field bắt buộc của model User.
        fullName: 'Admin',
        phone: '0000000000',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(), // admin bootstrap doesn't need email verification
        userRoles: { create: [{ roleId: adminRole.id }] },
      },
    });
    console.log(`Created admin ${email}.`);
  }

  // Luôn chạy dù admin đã tồn tại hay chưa — catalog tự idempotent qua
  // upsert riêng, không phụ thuộc vào nhánh admin ở trên.
  await seedCatalog();
}

// Dữ liệu mẫu để test tay qua Swagger/Postman (categories/products chưa có
// dữ liệu thật nào ngoài dữ liệu tạm do e2e test tạo rồi xoá). Idempotent
// bằng upsert theo slug/sku, giống cách seed admin ở trên — chạy lại
// script không tạo trùng.
async function seedCatalog(): Promise<void> {
  // Option Value dùng chung cho mọi product — variant chọn theo mã, SKU ghép
  // từ Product Code + mã màu/size (docs/adr/0011).
  const optionValues = [
    { type: 'COLOR', code: 'BLK', name: 'Black' },
    { type: 'COLOR', code: 'WHT', name: 'White' },
    { type: 'COLOR', code: 'BLU', name: 'Blue' },
    { type: 'COLOR', code: 'KHK', name: 'Khaki' },
    { type: 'COLOR', code: 'BRN', name: 'Brown' },
    { type: 'SIZE', code: 'M', name: 'M' },
    { type: 'SIZE', code: 'L', name: 'L' },
    { type: 'SIZE', code: '32', name: '32' },
    { type: 'SIZE', code: '41', name: '41' },
    { type: 'SIZE', code: '42', name: '42' },
  ] as const;
  const optionIdByKey = new Map<string, string>();
  for (const [position, value] of optionValues.entries()) {
    const row = await prisma.optionValue.upsert({
      where: { type_code: { type: value.type, code: value.code } },
      update: {},
      create: { ...value, position },
    });
    optionIdByKey.set(`${value.type}:${value.code}`, row.id);
  }

  const catalog = [
    {
      name: 'Shirts',
      products: [
        {
          name: 'Classic Cotton T-Shirt',
          code: 'TSHIRT',
          variants: [
            { color: 'BLK', size: 'M', price: 199000, quantity: 50 },
            { color: 'WHT', size: 'L', price: 199000, quantity: 30 },
          ],
        },
        {
          name: 'Slim Fit Dress Shirt',
          code: 'DRESS',
          variants: [{ color: 'BLU', size: 'M', price: 450000, quantity: 20 }],
        },
      ],
    },
    {
      name: 'Pants',
      products: [
        {
          name: 'Straight Leg Jeans',
          code: 'JEANS',
          variants: [{ color: 'BLU', size: '32', price: 550000, quantity: 40 }],
        },
        {
          name: 'Chino Trousers',
          code: 'CHINO',
          variants: [{ color: 'KHK', size: '32', price: 480000, quantity: 25 }],
        },
      ],
    },
    {
      name: 'Shoes',
      products: [
        {
          name: 'Running Sneakers',
          code: 'SNEAKER',
          variants: [{ color: 'BLK', size: '42', price: 890000, quantity: 15 }],
        },
        {
          name: 'Leather Loafers',
          code: 'LOAFER',
          variants: [{ color: 'BRN', size: '41', price: 1200000, quantity: 10 }],
        },
      ],
    },
  ];

  for (const categorySeed of catalog) {
    const categorySlug = slugify(categorySeed.name, { lower: true, strict: true });
    const category = await prisma.category.upsert({
      where: { slug: categorySlug },
      update: {},
      create: { name: categorySeed.name, slug: categorySlug },
    });

    for (const productSeed of categorySeed.products) {
      const productSlug = slugify(productSeed.name, { lower: true, strict: true });
      const product = await prisma.product.upsert({
        where: { slug: productSlug },
        update: {},
        create: { name: productSeed.name, code: productSeed.code, slug: productSlug, categoryId: category.id },
      });

      for (const variantSeed of productSeed.variants) {
        const sku = composeSku(product.code, variantSeed.color, variantSeed.size);
        const variant = await prisma.productVariant.upsert({
          where: { sku },
          update: {},
          create: {
            productId: product.id,
            sku,
            colorId: optionIdByKey.get(`COLOR:${variantSeed.color}`),
            sizeId: optionIdByKey.get(`SIZE:${variantSeed.size}`),
            price: variantSeed.price,
          },
        });
        // quantity > 0 (khác 0 khi tạo qua API thật) để test tay đọc
        // inventory có sẵn số lượng ngay, không cần gọi thêm adjust.
        await prisma.inventory.upsert({
          where: { variantId: variant.id },
          update: {},
          create: { variantId: variant.id, quantity: variantSeed.quantity, reservedQuantity: 0 },
        });
      }
    }
  }

  console.log(`Seeded catalog: ${catalog.length} categories.`);
}

main()
  .then(() => console.log('Seed complete.'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
