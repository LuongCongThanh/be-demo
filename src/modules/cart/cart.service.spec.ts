import { ConflictException, NotFoundException } from '@nestjs/common';
import { CartService } from '#src/modules/cart/cart.service.js';

function setup() {
  const prisma = {
    cart: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cartItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    productVariant: { findUnique: vi.fn() },
    salePrice: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { service: new CartService(prisma as never), prisma };
}

describe('CartService', () => {
  it('creates a guest cart without changing inventory', async () => {
    const { service, prisma } = setup();
    prisma.cart.findFirst.mockResolvedValue(null);
    prisma.cart.create.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      sessionId: 'guest-session',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
      items: [],
    });

    const result = await service.getGuestCart(undefined);

    expect(prisma.cart.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ expiresAt: expect.any(Date) }) }),
    );
    expect(result.sessionId).toBe('guest-session');
  });

  it('rejects quantities above 10', async () => {
    const { service, prisma } = setup();
    prisma.cart.findFirst.mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' });
    prisma.productVariant.findUnique.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      status: 'ACTIVE',
      price: 100_000n,
      inventory: { quantity: 100, reservedQuantity: 0 },
    });
    prisma.cartItem.findUnique.mockResolvedValue({ quantity: 8 });

    await expect(
      service.addGuestItem('guest-session', {
        variantId: '33333333-3333-4333-8333-333333333333',
        quantity: 3,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('returns not found when removing an item outside the cart', async () => {
    const { service, prisma } = setup();
    prisma.cart.findFirst.mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' });
    prisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.deleteGuestItem('guest-session', '44444444-4444-4444-8444-444444444444'),
    ).rejects.toThrow(NotFoundException);
  });
});
