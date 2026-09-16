import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

function createContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}) as never,
    getClass: () => ({}) as never,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function createGuard(requiredRoles: string[] | undefined) {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(requiredRoles) } as unknown as Reflector;
  return { guard: new RolesGuard(reflector), reflector };
}

describe('RolesGuard', () => {
  it('allows the request through when the route has no @Roles() metadata', () => {
    const { guard } = createGuard(undefined);

    expect(guard.canActivate(createContext({ sub: 'user-1', roles: [] }))).toBe(true);
  });

  it('reads required roles via the ROLES_KEY metadata key', () => {
    const { guard, reflector } = createGuard(['ADMIN']);
    const context = createContext({ sub: 'user-1', roles: ['ADMIN'] });

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [context.getHandler(), context.getClass()]);
  });

  it('denies when the route requires roles but request.user is missing (guard ran before JwtAuthGuard)', () => {
    const { guard } = createGuard(['ADMIN']);

    expect(guard.canActivate(createContext(undefined))).toBe(false);
  });

  it('denies when the user has roles but none of them are required', () => {
    const { guard } = createGuard(['ADMIN']);

    expect(guard.canActivate(createContext({ sub: 'user-1', roles: ['CUSTOMER'] }))).toBe(false);
  });

  it('allows when the user has at least one of the required roles', () => {
    const { guard } = createGuard(['ADMIN', 'STAFF']);

    expect(guard.canActivate(createContext({ sub: 'user-1', roles: ['STAFF'] }))).toBe(true);
  });
});
