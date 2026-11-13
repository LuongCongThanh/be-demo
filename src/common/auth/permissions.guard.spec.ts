import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '#src/common/auth/permissions.guard.js';
import { PERMISSIONS_KEY } from '#src/common/auth/permissions.decorator.js';

function createContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function createGuard(requiredPermissions: string[] | undefined) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(requiredPermissions) } as unknown as Reflector;
  return { guard: new PermissionsGuard(reflector), reflector };
}

describe('PermissionsGuard', () => {
  it('allows the request through when the route has no @Authorize() metadata', () => {
    const { guard } = createGuard(undefined);

    expect(guard.canActivate(createContext({ sub: 'user-1', permissions: [] }))).toBe(true);
  });

  it('reads required permissions via the PERMISSIONS_KEY metadata key', () => {
    const { guard, reflector } = createGuard(['CATALOG_PRODUCT_MANAGE']);
    const context = createContext({ sub: 'user-1', permissions: ['CATALOG_PRODUCT_MANAGE'] });

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('denies when the route requires permissions but request.user is missing (guard ran before JwtAuthGuard)', () => {
    const { guard } = createGuard(['CATALOG_PRODUCT_MANAGE']);

    expect(guard.canActivate(createContext(undefined))).toBe(false);
  });

  it('denies when the user lacks a required permission', () => {
    const { guard } = createGuard(['CATALOG_PRODUCT_MANAGE']);

    expect(guard.canActivate(createContext({ sub: 'user-1', permissions: ['CATALOG_PRODUCT_VIEW'] }))).toBe(false);
  });

  it('allows when the user has all the required permissions', () => {
    const { guard } = createGuard(['CATALOG_PRODUCT_VIEW', 'CATALOG_PRODUCT_MANAGE']);

    expect(
      guard.canActivate(
        createContext({ sub: 'user-1', permissions: ['CATALOG_PRODUCT_VIEW', 'CATALOG_PRODUCT_MANAGE'] }),
      ),
    ).toBe(true);
  });
});
