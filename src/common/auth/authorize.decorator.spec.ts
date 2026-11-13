import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { DECORATORS } from '@nestjs/swagger';
import { Authorize } from '#src/common/auth/authorize.decorator.js';
import { JwtAuthGuard } from '#src/common/auth/jwt-auth.guard.js';
import { PermissionsGuard } from '#src/common/auth/permissions.guard.js';
import { PERMISSIONS_KEY } from '#src/common/auth/permissions.decorator.js';
import { Permission } from '#src/common/auth/permission.enum.js';

@Authorize(Permission.CATALOG_PRODUCT_VIEW, Permission.CATALOG_CATEGORY_VIEW)
class FakeController {
  list() {}

  @Authorize(Permission.CATALOG_PRODUCT_MANAGE)
  remove() {}
}

@Authorize()
class LoginOnlyController {}

const reflector = new Reflector();
const permissionsFor = (handler: () => void, cls: new () => unknown) =>
  reflector.getAllAndOverride(PERMISSIONS_KEY, [handler, cls]);

describe('Authorize', () => {
  it('attaches JwtAuthGuard then PermissionsGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, FakeController)).toEqual([JwtAuthGuard, PermissionsGuard]);
  });

  it('records the class-level permissions for routes without their own @Authorize', () => {
    expect(permissionsFor(FakeController.prototype.list, FakeController)).toEqual([
      Permission.CATALOG_PRODUCT_VIEW,
      Permission.CATALOG_CATEGORY_VIEW,
    ]);
  });

  it('lets a method-level @Authorize override the class-level permissions', () => {
    expect(permissionsFor(FakeController.prototype.remove, FakeController)).toEqual([
      Permission.CATALOG_PRODUCT_MANAGE,
    ]);
  });

  it('with no permissions only requires login (empty permission list)', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, LoginOnlyController)).toEqual([JwtAuthGuard, PermissionsGuard]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, LoginOnlyController)).toEqual([]);
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

      @Authorize(Permission.CATALOG_PRODUCT_VIEW)
      me() {}
    }

    expect(Reflect.getMetadata(GUARDS_METADATA, MixedController.prototype.me)).toEqual([
      JwtAuthGuard,
      PermissionsGuard,
    ]);
    expect(Reflect.getMetadata(DECORATORS.API_SECURITY, MixedController.prototype.me)).toEqual([{ bearer: [] }]);
    expect(Reflect.getMetadata(GUARDS_METADATA, MixedController.prototype.open)).toBeUndefined();
  });
});
