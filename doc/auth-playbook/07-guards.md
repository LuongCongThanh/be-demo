# 07 — Guards: JwtAuthGuard, RolesGuard, OwnershipGuard

> Trước khi bắt đầu, đảm bảo bạn đã làm xong [06-refresh-token.md](./06-refresh-token.md): access token đã sinh được, refresh token đã hoạt động. Cần tra thuật ngữ nào đó thì mở [GLOSSARY.md](./GLOSSARY.md); cần nhắc lại quyết định thiết kế thì xem [00-overview.md](./00-overview.md).

File này xây 4 lớp bảo vệ route dùng chung cho toàn bộ endpoint cần đăng nhập: xác thực JWT (`JwtAuthGuard`), lấy user hiện tại (`@CurrentUser()`), kiểm tra role (`RolesGuard`), và kiểm tra quyền sở hữu resource (`OwnershipGuard`). Cả 4 việc này liên quan chặt tới nhau: đều chạy trong cùng 1 request pipeline (xem [00-overview.md § Architecture Overview](./00-overview.md)), nên gộp vào 1 file, chia thành 4 bước.

---

## Bước 1 — JwtAuthGuard + JwtStrategy

Đây là guard xác thực access token và gắn `CurrentUser` vào request. Đây là guard quan trọng nhất, mọi endpoint cần login đều đi qua nó.

> 📘 **Khái niệm: Passport Strategy hoạt động thế nào?**
> Passport (thư viện auth phổ biến, tích hợp vào Nest qua `@nestjs/passport`) làm việc theo mô hình **strategy**: mỗi strategy định nghĩa "lấy credential từ đâu" (ở đây: JWT trong header `Authorization: Bearer <token>`) và "verify credential đó ra sao". Bạn viết 1 class kế thừa `PassportStrategy(Strategy)`, override method `validate(payload)`. Passport tự động gọi `validate()` sau khi đã verify chữ ký + hạn JWT thành công, và **giá trị bạn `return` từ `validate()` chính là thứ được gắn vào `request.user`**. Nếu JWT sai chữ ký/hết hạn, Passport tự trả `401` mà không gọi tới `validate()`.
>
> 📘 **Khái niệm: `AuthGuard('jwt')` là gì?** `@nestjs/passport` cung cấp sẵn 1 Guard tổng quát `AuthGuard(strategyName)`: truyền tên strategy (`'jwt'`, đặt tên khi khai báo `PassportStrategy(Strategy, 'jwt')` hoặc mặc định theo tên class) để nó biết dùng strategy nào. `JwtAuthGuard` chỉ là 1 class rỗng kế thừa `AuthGuard('jwt')`. Tạo class riêng để dễ dùng `@UseGuards(JwtAuthGuard)` (thay vì `@UseGuards(AuthGuard('jwt'))` lặp lại chuỗi ma thuật ở nhiều nơi), và để sau này dễ override thêm logic nếu cần (vd custom lỗi 401).

Mở `src/auth/strategies/jwt.strategy.ts` (đã scaffold rỗng ở [01-setup.md](./01-setup.md)) và viết:

```ts
// src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  roles: string[]; // tên role, vd ['CUSTOMER'] hoặc ['ADMIN'] — không hardcode enum (quyết định #6)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // để Passport tự trả 401 khi token hết hạn
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Được Passport gọi SAU KHI đã verify chữ ký + hạn JWT thành công.
   * Giá trị return ở đây được gắn thẳng vào `request.user`.
   */
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
```

Rồi mở `src/auth/guards/jwt-auth.guard.ts` (cũng đã scaffold rỗng) và viết:

```ts
// src/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

Dùng trên route cần đăng nhập như sau:

```ts
@UseGuards(JwtAuthGuard)
@Get('me')
getMe(@CurrentUser() user: JwtPayload) { /* ... */ }
```

⚠️ `JwtStrategy` phải được khai báo trong mảng `providers` của `AuthModule` (không phải chỉ tạo file) để Nest biết strategy `'jwt'` tồn tại. Kiểm tra lại `auth.module.ts`.

Tự kiểm tra: gửi request không có header `Authorization` phải nhận `401`. Access token hết hạn hoặc sai chữ ký cũng phải `401`. Access token hợp lệ thì `request.user` phải có đúng payload (`sub`, `email`, `roles`).

---

## Bước 2 — `@CurrentUser()` decorator

Bước này viết 1 decorator để lấy user hiện tại từ request trong controller mà không cần tự inject `Request` thủ công mỗi lần.

> 📘 **Khái niệm: param decorator custom (`createParamDecorator`) hoạt động ra sao?** Nest cho phép tự định nghĩa decorator dùng trên tham số của method controller (giống `@Body()`, `@Param()` có sẵn) bằng `createParamDecorator(factory)`. `factory` nhận `(data, ctx: ExecutionContext)`: `ctx.switchToHttp().getRequest()` lấy về đúng object `Request` của Express/Fastify đang xử lý request hiện tại. Vì `JwtAuthGuard` (Bước 1) đã chạy trước và gắn `request.user = payload`, decorator chỉ cần đọc lại `request.user` ra.

Mở `src/auth/decorators/current-user.decorator.ts` (đã scaffold rỗng ở `01-setup.md`) và viết:

```ts
// src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../strategies/jwt.strategy';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
```

Dùng trong controller như sau:

```ts
@UseGuards(JwtAuthGuard)
@Get('me')
getMe(@CurrentUser() user: JwtPayload): Promise<AuthUserResponseDto> {
  return this.authService.getMe(user.sub);
}
```

⚠️ `@CurrentUser()` **phải** dùng sau `JwtAuthGuard` (guard chạy trước, gắn `request.user` trước khi decorator đọc). Nếu quên `@UseGuards(JwtAuthGuard)`, `request.user` sẽ là `undefined`.

Tự kiểm tra: dùng `@CurrentUser() user: JwtPayload` trong 1 controller có `@UseGuards(JwtAuthGuard)`: bạn phải nhận đúng user đang đăng nhập, không phải `undefined`.

---

## Bước 3 — RolesGuard + `@Roles()`

Bước này chặn route theo role, và phải tương thích với role model DB-driven (quyết định #6): không hardcode enum.

> 📘 **Khái niệm: `SetMetadata` + `Reflector` dùng để "gắn nhãn" lên route rồi đọc lại trong Guard như thế nào?** `SetMetadata(key, value)` gắn 1 cặp key-value vào metadata của method/class (dùng cơ chế `reflect-metadata` của TypeScript). `@Roles('ADMIN')` thực chất là gọi `SetMetadata('roles', ['ADMIN'])`. Guard không tự "thấy" được decorator này khi chạy. Nó phải dùng `Reflector` (Nest tự inject được) gọi `reflector.getAllAndOverride<string[]>('roles', [ctx.getHandler(), ctx.getClass()])` để đọc lại giá trị đã gắn. Nếu route không có `@Roles(...)`, `Reflector` trả `undefined` → Guard cho qua (không giới hạn role).

Mở `src/auth/decorators/roles.decorator.ts` và viết:

```ts
// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

Rồi mở `src/auth/guards/roles.guard.ts` và viết:

```ts
// src/auth/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // route không khai @Roles(...) → không giới hạn
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;
    if (!user) return false; // phải chạy sau JwtAuthGuard

    // So khớp string thuần với payload.roles — KHÔNG import enum cố định,
    // vì role là data trong DB (quyết định #6). Thêm role mới (vd STAFF) chỉ
    // cần seed thêm + dùng @Roles('STAFF') ở route mới, không sửa file này.
    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
```

Dùng trên route như sau:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get('admin-only')
adminOnlyEndpoint() { /* ... */ }
```

⚠️ Thứ tự `@UseGuards(JwtAuthGuard, RolesGuard)` quan trọng: `RolesGuard` cần `request.user` đã có (do `JwtAuthGuard` gắn vào); Nest chạy guard theo đúng thứ tự khai báo trong mảng.

Tự kiểm tra: route có `@Roles('ADMIN')`, user không có role ADMIN phải nhận `403`; user có role ADMIN phải qua được. Thử seed thêm 1 role mới (vd `STAFF`) và dùng `@Roles('STAFF')` ở 1 route khác. Nó phải hoạt động ngay lập tức, không cần sửa gì trong `RolesGuard`.

---

## Bước 4 — OwnershipGuard

Bước cuối cùng: chặn user truy cập resource không thuộc về mình, tách biệt khỏi những business rule phức tạp hơn (xem [00-overview.md § Guard vs Service](./00-overview.md)).

> 📘 **Khái niệm: vì sao `OwnershipGuard` cần 1 callback `fetch` thay vì tự biết cách query?** `OwnershipGuard` được viết 1 lần, dùng lại cho nhiều loại resource khác nhau (Order, Cart, Address...); mỗi loại có bảng/điều kiện query khác nhau. Guard không thể tự "biết" cách lấy 1 `Order` khác cách lấy 1 `Cart`. Giải pháp MVP: decorator `@OwnedResource()` nhận kèm 1 **callback `fetch`**: hàm do người dùng guard (dev viết route Order/Cart sau này) tự định nghĩa cách query đúng resource đó. Guard chỉ gọi lại callback này rồi so `resource.userId` với `currentUser.id`.
>
> ⚠️ **Giới hạn đã biết:** cách này khiến callback `fetch` bắt buộc biết cách gọi Prisma trực tiếp (coupling khá chặt), khác với thiết kế "guard hoàn toàn tách biệt khỏi tầng data". Đây là đánh đổi chấp nhận được cho MVP; xem hướng cải tiến ở [00-overview.md § Known Gaps](./00-overview.md).

Mở `src/auth/decorators/owned-resource.decorator.ts` và viết:

```ts
// src/auth/decorators/owned-resource.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // chỉnh path đúng repo

export interface OwnedResourceOptions {
  /** Tên param trong route chứa id của resource, vd 'id' trong `/orders/:id`. */
  paramIdKey: string;
  /** Callback tự query resource theo id, trả về object có field `userId` (hoặc null nếu không tồn tại). */
  fetch: (id: string, prisma: PrismaService) => Promise<{ userId: string } | null>;
}

export const OWNED_RESOURCE_KEY = 'ownedResource';
export const OwnedResource = (options: OwnedResourceOptions) => SetMetadata(OWNED_RESOURCE_KEY, options);
```

Rồi mở `src/auth/guards/ownership.guard.ts` và viết:

```ts
// src/auth/guards/ownership.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OWNED_RESOURCE_KEY, OwnedResourceOptions } from '../decorators/owned-resource.decorator';
import { PrismaService } from '../../prisma/prisma.service'; // chỉnh path đúng repo
import { JwtPayload } from '../strategies/jwt.strategy';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<OwnedResourceOptions>(OWNED_RESOURCE_KEY, context.getHandler());
    if (!options) return true; // route không khai @OwnedResource(...) → không áp dụng

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;
    if (!user) return false; // phải chạy sau JwtAuthGuard

    // ADMIN bypass — không cần kiểm tra ownership.
    if (user.roles.includes('ADMIN')) return true;

    const resourceId = request.params[options.paramIdKey];
    const resource = await options.fetch(resourceId, this.prisma);
    if (!resource) {
      throw new NotFoundException();
    }
    if (resource.userId !== user.sub) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }
    return true;
  }
}
```

Ví dụ cách dùng (áp dụng thật khi build Order module sau, đặt ở đây để bạn tham khảo cú pháp):

```ts
@UseGuards(JwtAuthGuard, OwnershipGuard)
@OwnedResource({
  paramIdKey: 'id',
  fetch: (id, prisma) =>
    prisma.order.findUnique({ where: { id }, select: { userId: true } }),
})
@Get('orders/:id')
getOrder(@Param('id') id: string) { /* ... */ }
```

Auth module ở đây chỉ cung cấp `OwnershipGuard` + `@OwnedResource()` dạng generic. Chưa có route nào dùng thật vì chưa có Order/Cart module. Bạn sẽ áp dụng cụ thể khi build Order module sau (xem [00-overview.md § 1. Scope](./00-overview.md), mục "Sau khi xong Auth MVP").

Tự kiểm tra: guard này phải compile/chạy được dù chưa có route nào dùng tới. Viết 1 route test nội bộ (hoặc để dành verify khi build Order module) để xác nhận user A không truy cập được resource của user B, và user có role ADMIN thì bypass được ownership check.

---

➡️ Tiếp theo: [08-me.md](./08-me.md)
