import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { AdminInventoryService } from '#src/modules/inventory/application/admin-inventory.service.js';
import { createTestApp } from '../support/create-test-app.js';

describe('Stock count confirmation on PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let service: AdminInventoryService;
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const userId = randomUUID();
  let variantId: string;
  let productId: string;
  let categoryId: string;
  let sizeId: string;
  let colorId: string;

  beforeAll(async () => {
    app = (await createTestApp()).app;
    prisma = app.get(PrismaService);
    service = app.get(AdminInventoryService, { strict: false });

    // Raw insert: only the columns this test needs, so the fixture does not depend on newer user columns.
    await prisma.$executeRaw`
      INSERT INTO users (id, email, password_hash, full_name, phone, role, updated_at)
      VALUES (${userId}::uuid, ${`race-${suffix.toLowerCase()}@example.test`}, 'x', 'Race Test', '0912345678', 'STAFF', now())`;
    categoryId = (
      await prisma.category.create({ data: { name: `Race ${suffix}`, slug: `race-${suffix.toLowerCase()}` } })
    ).id;
    sizeId = (await prisma.size.create({ data: { code: `R${suffix}`, name: 'Race' } })).id;
    colorId = (await prisma.color.create({ data: { code: `R${suffix}`, name: 'Race', hex: '#112233' } })).id;
    productId = (
      await prisma.product.create({
        data: { categoryId, name: `Race ${suffix}`, slug: `race-${suffix.toLowerCase()}`, weightGrams: 100 },
      })
    ).id;
    variantId = (
      await prisma.productVariant.create({
        data: { productId, sizeId, colorId, sku: `RACE-${suffix}`, price: 100000n },
      })
    ).id;
    await prisma.inventory.create({ data: { variantId, quantity: 10 } });
  });

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({ where: { variantId } });
    await prisma.inventoryStockCount.deleteMany({ where: { variantId } });
    await prisma.productVariant.deleteMany({ where: { id: variantId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.size.deleteMany({ where: { id: sizeId } });
    await prisma.color.deleteMany({ where: { id: colorId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.$executeRaw`DELETE FROM users WHERE id = ${userId}::uuid`;
    await app.close();
  });

  it('applies the delta and writes one movement when two confirms of one count run concurrently', async () => {
    const count = await service.createCount(variantId, userId, { physicalCount: 13 });

    const [first, second] = await Promise.all([
      service.confirmCount(count.id, userId),
      service.confirmCount(count.id, userId),
    ]);

    expect(first.confirmedAt).not.toBeNull();
    expect(second.confirmedAt).not.toBeNull();
    expect(second.id).toBe(count.id);
    await expect(prisma.inventory.findUnique({ where: { variantId } })).resolves.toMatchObject({ quantity: 13 });
    await expect(prisma.inventoryMovement.count({ where: { variantId } })).resolves.toBe(1);
  });

  it('returns the already confirmed count on a sequential second confirm', async () => {
    const count = await service.createCount(variantId, userId, { physicalCount: 12 });
    const confirmed = await service.confirmCount(count.id, userId);

    await expect(service.confirmCount(count.id, userId)).resolves.toEqual(confirmed);
    await expect(prisma.inventory.findUnique({ where: { variantId } })).resolves.toMatchObject({ quantity: 12 });
  });
});
