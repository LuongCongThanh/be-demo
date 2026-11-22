import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '#src/infrastructure/database/prisma.service.js';
import { PasswordService } from '#src/modules/identity/auth/services/shared/password.service.js';
import type { AccountType } from '#src/generated/prisma/enums.js';
import { createTestUser } from '../../support/create-test-user.js';
import { createTestApp } from '../../support/create-test-app.js';

const TEST_NAME_PREFIX = 'CheckoutCodE2E';
const TEST_EMAIL_DOMAIN = '@checkout-cod.e2e-test.local';
const TEST_CODE_PREFIX = 'E2CO';
const VALID_PASSWORD = 'Abc@1234';
const IDEMPOTENCY_PREFIX = 'cod-checkout-e2e-';

describe('Checkout — COD (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordService: PasswordService;
  let adminToken: string;
  let adminId: string;
  let customerToken: string;
  let customerId: string;
  let categoryId: string;
  let colorId: string;
  let sizeId: string;
  const productIds: string[] = [];
  const variantIds: string[] = [];
  const quoteIds: string[] = [];
  const voucherIds: string[] = [];

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.moduleFixture.get(PrismaService);
    passwordService = created.moduleFixture.get(PasswordService);

    adminToken = await tokenFor('ADMIN');
    const customer = await createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix: 'customer-',
      passwordHash: await passwordService.hash(VALID_PASSWORD),
      role: 'CUSTOMER',
      emailVerifiedAt: new Date(),
    });
    customerId = customer.id;
    customerToken = await login(customer.email);

    const category = await prisma.category.create({
      data: {
        name: `${TEST_NAME_PREFIX} category`,
        slug: `${TEST_NAME_PREFIX.toLowerCase()}-${randomUUID()}`,
      },
    });
    categoryId = category.id;
    colorId = (
      await prisma.color.create({
        data: {
          code: `${TEST_CODE_PREFIX}C${randomUUID().slice(0, 8).toUpperCase()}`,
          name: 'Checkout test',
          hex: '#123456',
        },
      })
    ).id;
    sizeId = (
      await prisma.size.create({
        data: { code: `${TEST_CODE_PREFIX}S${randomUUID().slice(0, 8).toUpperCase()}`, name: 'Checkout test' },
      })
    ).id;
  });

  afterAll(async () => {
    const orders = await prisma.order.findMany({
      where: { contactPhone: { startsWith: '0999000' } },
      select: { id: true },
    });
    const orderIds = orders.map(({ id }) => id);
    await prisma.awaitingDispatchItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.voucherUsage.deleteMany({ where: { orderId: { in: orderIds } } });
    if (voucherIds.length > 0) {
      await prisma.voucherUsage.deleteMany({ where: { voucherId: { in: voucherIds } } });
      await prisma.voucher.updateMany({ where: { id: { in: voucherIds } }, data: { usedCount: 0 } });
      await prisma.voucher.deleteMany({ where: { id: { in: voucherIds } } });
    }
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.idempotencyKey.deleteMany({
      where: { scope: 'checkout.place-order', key: { startsWith: IDEMPOTENCY_PREFIX } },
    });
    await prisma.checkoutQuote.deleteMany({ where: { id: { in: quoteIds } } });
    await prisma.inventory.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.size.deleteMany({ where: { id: sizeId } });
    await prisma.color.deleteMany({ where: { id: colorId } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_EMAIL_DOMAIN } } });
    await app.close();
  });

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string): Promise<string> {
    const response = await request(server())
      .post('/api/v1/auth/login')
      .send({ email, password: VALID_PASSWORD })
      .expect(200);
    return response.body.accessToken as string;
  }

  async function tokenFor(role: AccountType): Promise<string> {
    const user = await createTestUser(prisma, {
      emailDomain: TEST_EMAIL_DOMAIN,
      emailSuffix: `${role.toLowerCase()}-`,
      passwordHash: await passwordService.hash(VALID_PASSWORD),
      role,
      emailVerifiedAt: new Date(),
    });
    if (role === 'ADMIN') adminId = user.id;
    return login(user.email);
  }

  async function createVariant(price = 150_000) {
    const productResponse = await request(server())
      .post('/api/v1/admin/products')
      .set(auth(adminToken))
      .send({
        name: `${TEST_NAME_PREFIX} ${randomUUID()}`,
        categoryId,
        weightGrams: 250,
        gender: 'UNISEX',
      })
      .expect(201);
    const productId = productResponse.body.id as string;
    productIds.push(productId);
    await request(server())
      .patch(`/api/v1/admin/products/${productId}`)
      .set(auth(adminToken))
      .send({ status: 'ACTIVE' })
      .expect(200);

    const variantResponse = await request(server())
      .post(`/api/v1/admin/products/${productId}/variants`)
      .set(auth(adminToken))
      .send({ sku: `${TEST_CODE_PREFIX}-${randomUUID().slice(0, 12).toUpperCase()}`, sizeId, colorId, price })
      .expect(201);
    const variantId = variantResponse.body.id as string;
    variantIds.push(variantId);
    await prisma.inventory.update({ where: { variantId }, data: { quantity: 5 } });
    return variantId;
  }

  function quoteBody(variantId: string, phone = '09990001234') {
    return {
      items: [{ variantId, quantity: 2 }],
      contactName: 'Checkout Test',
      contactPhone: phone,
      shippingProvinceCode: '79',
      shippingWardCode: '26734',
      shippingAddress: '123 Nguyen Hue',
    };
  }

  async function createQuote(variantId: string, token?: string) {
    const req = request(server()).post('/api/v1/checkout/quote');
    if (token) req.set(auth(token));
    const response = await req.send(quoteBody(variantId)).expect(201);
    quoteIds.push(response.body.quoteId as string);
    return response.body as { quoteId: string; total: number; expiresAt: string };
  }

  it('creates a guest COD order atomically and replays idempotently', async () => {
    const variantId = await createVariant();
    const quote = await createQuote(variantId);

    await request(server()).post('/api/v1/checkout/orders/COD').send({ quoteId: quote.quoteId }).expect(400);

    const idempotencyKey = `${IDEMPOTENCY_PREFIX}${randomUUID()}`;
    const [first, retry] = await Promise.all([
      request(server())
        .post('/api/v1/checkout/orders/COD')
        .set('Idempotency-Key', idempotencyKey)
        .send({ quoteId: quote.quoteId })
        .expect(201),
      request(server())
        .post('/api/v1/checkout/orders/COD')
        .set('Idempotency-Key', idempotencyKey)
        .send({ quoteId: quote.quoteId })
        .expect(201),
    ]);

    expect(retry.body).toEqual(first.body);
    await request(server())
      .post('/api/v1/checkout/orders/COD')
      .set('Idempotency-Key', idempotencyKey)
      .send({ quoteId: randomUUID() })
      .expect(409);

    const order = await prisma.order.findUniqueOrThrow({ where: { quoteId: quote.quoteId } });
    expect(order).toMatchObject({ userId: null, paymentMethod: 'COD', status: 'PLACED', total: BigInt(330_000) });
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).toMatchObject({ quantity: 3 });
    expect(
      await prisma.awaitingDispatchItem.findUniqueOrThrow({
        where: { orderId_variantId: { orderId: order.id, variantId } },
      }),
    ).toMatchObject({ quantity: 2 });
  });

  it('rejects a stale quote without creating an order or decrementing inventory', async () => {
    const variantId = await createVariant();
    const quote = await createQuote(variantId);
    await prisma.productVariant.update({ where: { id: variantId }, data: { price: 160_000n } });

    await request(server())
      .post('/api/v1/checkout/orders/COD')
      .set('Idempotency-Key', `${IDEMPOTENCY_PREFIX}${randomUUID()}`)
      .send({ quoteId: quote.quoteId })
      .expect(409);

    expect(await prisma.order.findUnique({ where: { quoteId: quote.quoteId } })).toBeNull();
    expect(await prisma.inventory.findUniqueOrThrow({ where: { variantId } })).toMatchObject({ quantity: 5 });
  });

  it('associates an authenticated Customer quote and order with that account', async () => {
    const variantId = await createVariant();
    const quote = await createQuote(variantId, customerToken);

    const order = await request(server())
      .post('/api/v1/checkout/orders/COD')
      .set(auth(customerToken))
      .set('Idempotency-Key', `${IDEMPOTENCY_PREFIX}${randomUUID()}`)
      .send({ quoteId: quote.quoteId })
      .expect(201);

    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.body.id } })).toMatchObject({
      userId: customerId,
    });
  });

  it('records voucher usage with the order and rejects COD over the default limit', async () => {
    const code = `${TEST_CODE_PREFIX}V${randomUUID().slice(0, 8).toUpperCase()}`;
    const voucher = await prisma.voucher.create({
      data: {
        code,
        type: 'FIXED',
        value: 10_000n,
        minSubtotal: 0n,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 86_400_000),
        isActive: true,
        createdById: adminId,
      },
    });
    voucherIds.push(voucher.id);

    const discountedVariant = await createVariant();
    const discountedQuoteResponse = await request(server())
      .post('/api/v1/checkout/quote')
      .send({ ...quoteBody(discountedVariant), voucherCode: code })
      .expect(201);
    quoteIds.push(discountedQuoteResponse.body.quoteId as string);
    expect(discountedQuoteResponse.body.discount).toBe(10_000);

    const placed = await request(server())
      .post('/api/v1/checkout/orders/COD')
      .set('Idempotency-Key', `${IDEMPOTENCY_PREFIX}${randomUUID()}`)
      .send({ quoteId: discountedQuoteResponse.body.quoteId })
      .expect(201);
    expect(await prisma.voucherUsage.findFirst({ where: { orderId: placed.body.id } })).toMatchObject({
      voucherId: voucher.id,
      discount: 10_000n,
    });
    expect((await prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id } })).usedCount).toBe(1);

    const overLimitVariant = await createVariant(6_000_000);
    const overLimitQuote = await createQuote(overLimitVariant);
    expect(overLimitQuote.total).toBeGreaterThan(10_000_000);
    await request(server())
      .post('/api/v1/checkout/orders/COD')
      .set('Idempotency-Key', `${IDEMPOTENCY_PREFIX}${randomUUID()}`)
      .send({ quoteId: overLimitQuote.quoteId })
      .expect(409);
    expect(await prisma.order.findUnique({ where: { quoteId: overLimitQuote.quoteId } })).toBeNull();
  });
});
