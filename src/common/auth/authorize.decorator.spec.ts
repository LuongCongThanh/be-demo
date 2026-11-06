import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { DECORATORS } from '@nestjs/swagger';
import { Authorize } from '#src/common/auth/authorize.decorator.js';
import { JwtAuthGuard } from '#src/common/auth/jwt-auth.guard.js';
import { RolesGuard } from '#src/common/auth/roles.guard.js';
import { ROLES_KEY } from '#src/common/auth/roles.decorator.js';

@Authorize('STAFF', 'ADMIN')
class FakeController {
  list() {}

  @Authorize('ADMIN')
  remove() {}
}

@Authorize()
class LoginOnlyController {}

const reflector = new Reflector();
const rolesFor = (handler: () => void, cls: new () => unknown) =>
  reflector.getAllAndOverride(ROLES_KEY, [handler, cls]);

describe('Authorize', () => {
  it('attaches JwtAuthGuard then RolesGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, FakeController)).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('records the class-level roles for routes without their own @Authorize', () => {
    expect(rolesFor(FakeController.prototype.list, FakeController)).toEqual(['STAFF', 'ADMIN']);
  });

  it('lets a method-level @Authorize override the class-level roles', () => {
    expect(rolesFor(FakeController.prototype.remove, FakeController)).toEqual(['ADMIN']);
  });

  it('with no roles only requires login (empty role list)', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, LoginOnlyController)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, LoginOnlyController)).toEqual([]);
  });

  it('declares Swagger bearer auth', () => {
    expect(Reflect.getMetadata(DECORATORS.API_SECURITY, FakeController)).toEqual([{ bearer: [] }]);
  });

  it('does not repeat guards or bearer on a method override when the class is already authorized', () => {
    const remove = FakeController.prototype.remove;
    expect(Reflect.getMetadata(GUARDS_METADATA, remove) ?? []).toEqual([]);
    expect(Reflect.getMetadata(DECORATORS.API_SECURITY, remove) ?? []).toEqual([]);
  });

  it('a method-level @Authorize on an unauthorized class guards and documents that method alone', () => {
    class MixedController {
      open() {}

      @Authorize('CUSTOMER')
      me() {}
    }

    expect(Reflect.getMetadata(GUARDS_METADATA, MixedController.prototype.me)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(DECORATORS.API_SECURITY, MixedController.prototype.me)).toEqual([{ bearer: [] }]);
    expect(Reflect.getMetadata(GUARDS_METADATA, MixedController.prototype.open)).toBeUndefined();
  });
});
