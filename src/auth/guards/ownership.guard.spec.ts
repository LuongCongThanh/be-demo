import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OwnershipGuard } from './ownership.guard.js';
import { OwnedResourceOptions } from '../decorators/owned-resource.decorator.js';

function createContext(user: unknown, params: Record<string, string> = {}): ExecutionContext {
  return {
    getHandler: () => ({}) as never,
    switchToHttp: () => ({
      getRequest: () => ({ user, params }),
    }),
  } as unknown as ExecutionContext;
}

function createGuard(options: OwnedResourceOptions | undefined) {
  const reflector = { get: vi.fn().mockReturnValue(options) } as unknown as Reflector;
  const prisma = {} as never;
  return { guard: new OwnershipGuard(reflector, prisma), reflector };
}

describe('OwnershipGuard', () => {
  it('allows the request through when the route has no @OwnedResource() metadata', async () => {
    const { guard } = createGuard(undefined);

    await expect(guard.canActivate(createContext({ sub: 'user-1', roles: [] }))).resolves.toBe(true);
  });

  it('denies when the route requires ownership but request.user is missing (guard ran before JwtAuthGuard)', async () => {
    const fetch = vi.fn();
    const { guard } = createGuard({ paramIdKey: 'id', fetch });

    await expect(guard.canActivate(createContext(undefined, { id: 'resource-1' }))).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('bypasses ownership check entirely for a user with the ADMIN role, without calling fetch', async () => {
    const fetch = vi.fn();
    const { guard } = createGuard({ paramIdKey: 'id', fetch });

    await expect(
      guard.canActivate(createContext({ sub: 'admin-1', roles: ['ADMIN'] }, { id: 'resource-1' })),
    ).resolves.toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when fetch() finds no resource for the given id', async () => {
    const fetch = vi.fn().mockResolvedValue(null);
    const { guard } = createGuard({ paramIdKey: 'id', fetch });

    await expect(
      guard.canActivate(createContext({ sub: 'user-1', roles: ['CUSTOMER'] }, { id: 'missing-resource' })),
    ).rejects.toThrow(NotFoundException);
    expect(fetch).toHaveBeenCalledWith('missing-resource', expect.anything());
  });

  it('throws ForbiddenException when the resource belongs to a different user', async () => {
    const fetch = vi.fn().mockResolvedValue({ userId: 'someone-else' });
    const { guard } = createGuard({ paramIdKey: 'id', fetch });

    await expect(
      guard.canActivate(createContext({ sub: 'user-1', roles: ['CUSTOMER'] }, { id: 'resource-1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows when the resource belongs to the requesting user', async () => {
    const fetch = vi.fn().mockResolvedValue({ userId: 'user-1' });
    const { guard } = createGuard({ paramIdKey: 'id', fetch });

    await expect(
      guard.canActivate(createContext({ sub: 'user-1', roles: ['CUSTOMER'] }, { id: 'resource-1' })),
    ).resolves.toBe(true);
  });
});
