import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import slugify from 'slugify';
import { ADMIN_ROLE_PERMISSIONS, STAFF_ROLE_PERMISSIONS, type Permission } from '../src/common/auth/permission.enum.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // Deliberate exception: this script runs standalone, outside the Nest DI
  // container (no ConfigService to inject), so it's allowed to read
  // process.env directly — the one exception to "config only via
  // ConfigService" in this codebase.
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    throw new Error('Missing ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD in .env');
  }

  // Upsert theo email: user đã tồn tại chỉ được đảm bảo role = ADMIN, KHÔNG
  // ghi đè mật khẩu (người dùng có thể đã đổi mật khẩu sau lần seed đầu).
  const roleIds = await seedSystemRoles();

  const passwordHash = await argon2.hash(password);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: {
      email,
      passwordHash,
      // fullName/phone không có ý nghĩa thật với tài khoản bootstrap này
      // (không phải khách hàng đăng ký qua form) — điền placeholder cố định
      // để thoả field bắt buộc của model User.
      fullName: 'Admin',
      phone: '0000000000',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(), // admin bootstrap doesn't need email verification
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roleIds.Admin } },
    update: {},
    create: { userId: admin.id, roleId: roleIds.Admin },
  });
  console.log(`Ensured admin ${email}.`);

  // Luôn chạy dù admin đã tồn tại hay chưa — catalog tự idempotent qua
  // upsert riêng, không phụ thuộc vào nhánh admin ở trên.
  await seedCatalog();
}

// Hai Vai trò hệ thống (không xoá được). Admin luôn bằng toàn bộ enum Permission nên được
// đồng bộ lại mỗi lần seed; Staff chỉ tạo mới Quyền mặc định, không ghi đè phần Admin đã chỉnh.
async function seedSystemRoles(): Promise<Record<'Admin' | 'Staff', string>> {
  const defs: Array<{
    name: 'Admin' | 'Staff';
    description: string;
    permissions: readonly Permission[];
    sync: boolean;
  }> = [
    { name: 'Admin', description: 'Quản trị viên: toàn bộ Quyền', permissions: ADMIN_ROLE_PERMISSIONS, sync: true },
    { name: 'Staff', description: 'Nhân viên vận hành', permissions: STAFF_ROLE_PERMISSIONS, sync: false },
  ];
  const ids = {} as Record<'Admin' | 'Staff', string>;
  for (const def of defs) {
    const existing = await prisma.role.findUnique({ where: { name: def.name } });
    const role =
      existing ??
      (await prisma.role.create({
        data: { name: def.name, description: def.description, isSystem: true },
      }));
    ids[def.name] = role.id;
    if (!existing || def.sync) {
      await prisma.rolePermission.createMany({
        data: def.permissions.map((permission) => ({ roleId: role.id, permission })),
        skipDuplicates: true,
      });
    }
  }
  return ids;
}

// Dữ liệu mẫu để test tay qua Swagger/Postman (categories/products chưa có
// dữ liệu thật nào ngoài dữ liệu tạm do e2e test tạo rồi xoá). Idempotent
// bằng upsert theo slug/sku, giống cách seed admin ở trên — chạy lại
// script không tạo trùng.
async function seedCatalog(): Promise<void> {
  // Danh sách size/màu dùng chung (BR-CAT-11). FREESIZE cho sản phẩm không có size.
  const sizes = [
    { code: 'FREESIZE', name: 'Free size', sortOrder: 0 },
    { code: 'S', name: 'S', sortOrder: 10 },
    { code: 'M', name: 'M', sortOrder: 20 },
    { code: 'L', name: 'L', sortOrder: 30 },
    { code: '32', name: '32', sortOrder: 132 },
    { code: '41', name: '41', sortOrder: 241 },
    { code: '42', name: '42', sortOrder: 242 },
  ];
  const colors = [
    { code: 'BLK', name: 'Đen', hex: '#000000' },
    { code: 'WHT', name: 'Trắng', hex: '#FFFFFF' },
    { code: 'BLU', name: 'Xanh dương', hex: '#1E40AF' },
    { code: 'KHK', name: 'Kaki', hex: '#C3B091' },
    { code: 'BRN', name: 'Nâu', hex: '#6B4226' },
  ];
  const sizeIds = new Map<string, string>();
  const colorIds = new Map<string, string>();
  for (const size of sizes) {
    const row = await prisma.size.upsert({ where: { code: size.code }, update: {}, create: size });
    sizeIds.set(size.code, row.id);
  }
  for (const color of colors) {
    const row = await prisma.color.upsert({ where: { code: color.code }, update: {}, create: color });
    colorIds.set(color.code, row.id);
  }

  const catalog = [
    {
      name: 'Shirts',
      products: [
        {
          name: 'Classic Cotton T-Shirt',
          variants: [
            { sku: 'SHIRT-TSHIRT-BLK-M', color: 'BLK', size: 'M', price: 199000, quantity: 50 },
            { sku: 'SHIRT-TSHIRT-WHT-L', color: 'WHT', size: 'L', price: 199000, quantity: 30 },
          ],
        },
        {
          name: 'Slim Fit Dress Shirt',
          variants: [{ sku: 'SHIRT-DRESS-BLU-M', color: 'BLU', size: 'M', price: 450000, quantity: 20 }],
        },
        {
          name: 'Oversized Polo Shirt',
          variants: [
            { sku: 'SHIRT-POLO-WHT-S', color: 'WHT', size: 'S', price: 320000, quantity: 18 },
            { sku: 'SHIRT-POLO-WHT-M', color: 'WHT', size: 'M', price: 320000, quantity: 22 },
            { sku: 'SHIRT-POLO-BLK-L', color: 'BLK', size: 'L', price: 320000, quantity: 12 },
          ],
        },
        {
          name: 'Linen Short Sleeve Shirt',
          variants: [
            { sku: 'SHIRT-LINEN-KHK-M', color: 'KHK', size: 'M', price: 390000, quantity: 15 },
            // Hết hàng: để test tay hiển thị out-of-stock.
            { sku: 'SHIRT-LINEN-KHK-L', color: 'KHK', size: 'L', price: 390000, quantity: 0 },
          ],
        },
      ],
    },
    {
      name: 'Pants',
      products: [
        {
          name: 'Straight Leg Jeans',
          variants: [{ sku: 'PANTS-JEANS-BLU-32', color: 'BLU', size: '32', price: 550000, quantity: 40 }],
        },
        {
          name: 'Chino Trousers',
          variants: [{ sku: 'PANTS-CHINO-KHK-32', color: 'KHK', size: '32', price: 480000, quantity: 25 }],
        },
      ],
    },
    {
      name: 'Shoes',
      products: [
        {
          name: 'Running Sneakers',
          variants: [{ sku: 'SHOES-SNEAKER-BLK-42', color: 'BLK', size: '42', price: 890000, quantity: 15 }],
        },
        {
          name: 'Leather Loafers',
          variants: [{ sku: 'SHOES-LOAFER-BRN-41', color: 'BRN', size: '41', price: 1200000, quantity: 10 }],
        },
      ],
    },
    {
      name: 'Accessories',
      products: [
        {
          name: 'Leather Belt',
          variants: [
            { sku: 'ACC-BELT-BLK-FREE', color: 'BLK', size: 'FREESIZE', price: 290000, quantity: 35 },
            { sku: 'ACC-BELT-BRN-FREE', color: 'BRN', size: 'FREESIZE', price: 290000, quantity: 20 },
          ],
        },
        {
          name: 'Canvas Tote Bag',
          variants: [{ sku: 'ACC-TOTE-WHT-FREE', color: 'WHT', size: 'FREESIZE', price: 150000, quantity: 60 }],
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
        create: {
          name: productSeed.name,
          slug: productSlug,
          categoryId: category.id,
          weightGrams: 400,
          // Dữ liệu mẫu cho storefront: publish luôn thay vì để DRAFT mặc định.
          status: 'ACTIVE',
          publishedAt: new Date(),
        },
      });

      for (const variantSeed of productSeed.variants) {
        const variant = await prisma.productVariant.upsert({
          where: { sku: variantSeed.sku },
          update: {},
          create: {
            productId: product.id,
            sku: variantSeed.sku,
            colorId: colorIds.get(variantSeed.color)!,
            sizeId: sizeIds.get(variantSeed.size)!,
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

  const productCount = catalog.reduce((n, c) => n + c.products.length, 0);
  const variantCount = catalog.reduce((n, c) => n + c.products.reduce((m, p) => m + p.variants.length, 0), 0);
  console.log(`Seeded catalog: ${catalog.length} categories, ${productCount} products, ${variantCount} variants.`);
}

main()
  .then(() => console.log('Seed complete.'))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
