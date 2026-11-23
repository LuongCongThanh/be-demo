# Research 11: nestjs-cls transactional có chạy với NestJS 12 và Prisma 7 không

Ticket: `issues/11-nestjs-cls-transactional-compatibility.md`
Ngày: 2026-11-24
Phạm vi: chỉ nêu sự thật, **không quyết định thay người dùng**. Quy ước: **[Đã chạy]** = chạy thật và có output; **[Đã đọc]** = đọc nguồn chính (npm metadata, source trong `node_modules`, docs, GitHub); **[Suy luận]** = kết luận của người viết.

## 1. Kết luận ngắn

**Tương thích** (có vài lưu ý, không có lỗi chặn). Cả 3 gói cài được, typecheck sạch, và 11/11 test trên PostgreSQL thật đều pass: commit, rollback, propagation Required mặc định, `Nested` (savepoint), `$queryRaw`, `SELECT ... FOR UPDATE` chặn thật, `isolationLevel`, cùng tồn tại với `AsyncLocalStorage` hiện có.

## 2. Phiên bản và peer dependency [Đã đọc: `npm view`]

| Gói                                        | Bản mới nhất | Publish    | peerDependencies                                                                                    |
| ------------------------------------------ | ------------ | ---------- | --------------------------------------------------------------------------------------------------- |
| `nestjs-cls`                               | 7.0.2        | 2026-10-27 | `@nestjs/core` `>= 10 < 13`, `@nestjs/common` `>= 10 < 13`, `rxjs >= 7`, `reflect-metadata *`       |
| `@nestjs-cls/transactional`                | 4.0.2        | 2026-10-27 | như trên + `nestjs-cls ^7.0.0`                                                                      |
| `@nestjs-cls/transactional-adapter-prisma` | 2.0.2        | 2026-10-27 | `prisma > 4 < 9`, `@prisma/client > 4 < 9`, `nestjs-cls ^7.0.0`, `@nestjs-cls/transactional ^4.0.0` |

Repo dùng Nest `12.0.1`, Prisma `7.10.0`: nằm trong mọi range. Cài thật không có cảnh báo peer (`npm ls` sạch).

Phiên bản đã test: `nestjs-cls@7.0.2`, `@nestjs-cls/transactional@4.0.2`, `@nestjs-cls/transactional-adapter-prisma@2.0.2`, `@nestjs/core@12.0.1`, `@prisma/client@7.10.0`, `prisma@7.10.0`, `@prisma/adapter-pg@7.10.0`, `vitest@5.1.0`, `typescript@6.0.3`, Node v24.22.2, PostgreSQL local (qua `DATABASE_URL` trong `.env`).

## 3. Kết quả từng kiểm tra

Thử nghiệm ở `<worktree>/probe/` (project riêng, copy cách dựng `PrismaService` của repo: `extends PrismaClient` sinh ra ở output tùy chỉnh `src/generated/prisma`, adapter `PrismaPg`). Dùng pg schema tạm `cls_probe` trong DB dev, đã `DROP` sau khi chạy; không đụng dữ liệu app.

| #    | Kiểm tra                                                                             | Kết quả    | Bằng chứng                                                                                                  |
| ---- | ------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------- |
| 0    | Cài + `tsc --noEmit` (strict, nodenext, `TransactionalAdapterPrisma<PrismaService>`) | **passed** | `tsc` không in lỗi                                                                                          |
| a    | Commit 2 ghi trong một `withTransaction`                                             | **passed** | count = 2                                                                                                   |
| b    | Rollback khi throw                                                                   | **passed** | thấy bản ghi trong tx (count=1), sau throw count = 0                                                        |
| c    | `withTransaction` lồng nhau mặc định = Required (dùng chung tx)                      | **passed** | `host.tx` trong và ngoài là cùng object; outer throw sau inner "thành công" thì ghi của inner cũng rollback |
| c2   | `Propagation.RequiresNew` mở tx riêng                                                | **passed** | `innerTx !== outerTx`                                                                                       |
| d    | `tx.$queryRaw` trong tx                                                              | **passed** | `SELECT 1::int` trả `[{one:1}]`                                                                             |
| d2   | `SELECT ... FOR UPDATE` qua `$queryRaw`                                              | **passed** | tx2 chờ tx1 commit: thứ tự `t1-locked, t1-commit, t2-locked` (607ms)                                        |
| e    | `isolationLevel` (Serializable, RepeatableRead + `timeout`/`maxWait`)                | **passed** | `current_setting('transaction_isolation')` trả `serializable` / `repeatable read`                           |
| h    | `Propagation.Nested` (savepoint)                                                     | **passed** | inner throw bắt được: chỉ ghi của inner bị rollback, count = 1. **Cần `sqlFlavor: 'postgresql'`**           |
| f    | Ngoài tx, `txHost.tx === prismaService`                                              | **passed** |                                                                                                             |
| g    | Cùng tồn tại với `RequestContext` (ALS hiện có)                                      | **passed** | `getRequestId()` còn nguyên qua `await` trong tx                                                            |
| HTTP | `ClsModule` middleware + middleware request-id, 4 request song song                  | **passed** | `rid` đúng `r1..r4`, `cls.isActive()` và tx đều true                                                        |

Kết quả cuối: `Tests 11 passed (11)`.

## 4. Wiring chạy được

```ts
// PrismaService (giống repo): extends PrismaClient từ output tùy chỉnh, adapter PrismaPg
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}

ClsModule.forRoot({
  global: true,
  middleware: { mount: true },
  plugins: [
    new ClsPluginTransactional({
      imports: [PrismaModule],               // module cung cấp PrismaService
      adapter: new TransactionalAdapterPrisma({
        prismaInjectionToken: PrismaService, // token = class PrismaService
        sqlFlavor: 'postgresql',             // chỉ cần cho Propagation.Nested
      }),
    }),
  ],
})

// dùng
type Host = TransactionHost<TransactionalAdapterPrisma<PrismaService>>;
constructor(@Inject(TransactionHost) private readonly txHost: Host) {}
this.txHost.tx.item.create(...)          // tx.$queryRaw cũng dùng được
this.txHost.withTransaction(async () => {...})
this.txHost.withTransaction({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }, async () => {...})
```

## 5. Giới hạn và lưu ý

1. **Typing với output tùy chỉnh**: không có lỗi. Docs nói mặc định adapter giả định client là `@prisma/client`; với client khác phải truyền generic `TransactionalAdapterPrisma<PrismaService>` (docs mục "Custom client type"). Đã làm vậy và `tsc` sạch. Docs cảnh báo phải đăng ký module bằng custom client, không phải client mặc định.
2. **`Propagation.Nested` cần `sqlFlavor`**: Prisma không có nested transaction native; adapter tự dùng `SAVEPOINT` bằng raw query (đọc source `transactional-adapter-prisma.js`: `$executeRawUnsafe` save/release/rollback). Không đặt `sqlFlavor` thì không có Nested.
3. **Prisma interactive transaction**: mặc định timeout 5000ms, `maxWait` 2000ms của Prisma; đổi qua options của `withTransaction`. Giới hạn này thuộc Prisma, không thuộc thư viện.
4. **DI trong vitest**: vitest mặc định không phát `emitDecoratorMetadata`, nên inject bằng type (`constructor(txHost: Host)`) fail với `Nest can't resolve dependencies`. Phải dùng `@Inject(TransactionHost)` (hoặc plugin SWC). Đây là hạn chế của cách chạy test, không phải của thư viện; `nest build` (tsc) vẫn phát metadata.
5. **Raw SQL không theo option `schema` của `PrismaPg`** (chi tiết của thử nghiệm; repo dùng schema `public` nên không ảnh hưởng).
6. **Jest + NestJS 12 ESM**: issue #631 (đã đóng) nói Jest 30 ESM không test được `nestjs-cls` (CJS) với Nest 12. Repo dùng vitest và test vitest ở trên chạy được. **[Suy luận]**: chỉ cần để ý nếu sau này đổi sang Jest.
7. **Không test**: `@Transactional()` decorator (chỉ test `withTransaction`; cùng cơ chế bên dưới); `ClsInterceptor`/guard mode (chỉ test middleware mode); `nest build` đầy đủ (chỉ `tsc --noEmit`); hành vi dưới tải/pool cạn; chưa chạy trong cây `src/` thật của repo (worktree cũ, thiếu source) mà dựng project probe tương đương.

## 6. Tương tác với `AsyncLocalStorage` hiện có

`request-context.ts` dùng `new AsyncLocalStorage<RequestStore>()` riêng. `nestjs-cls` tạo instance `AsyncLocalStorage` riêng của nó. Hai ALS độc lập trong Node không ghi đè nhau. [Đã chạy] test g và test HTTP: middleware request-id (`RequestContext.run`) và `ClsModule` middleware cùng mount, 4 request song song, mỗi request thấy đúng `requestId` và `cls.isActive()`/`isTransactionActive()` đều true trong tx. Trong probe, middleware request-id đăng ký sau middleware của ClsModule; thứ tự ngược lại không được thử.

## 7. Bảo trì [Đã đọc: GitHub, npm]

- Repo `Papooch/nestjs-cls`: 712 sao, push gần nhất 2026-11-19; release dày: `nestjs-cls` 6.2.2 (08-25), 6.3.0 (09-04), 7.0.0 (09-20), 7.0.1 (09-24), 7.0.2 (10-27).
- Hỗ trợ Nest 12: issue #626 đóng 2026-09-04, release `nestjs-cls@6.3.0` ("no breaking changes, requires Node 20+ and ESM").
- Hỗ trợ Prisma 7: issue #430 đóng 2025-12-15, release `transactional-adapter-prisma@1.3.2`; maintainer nói phải kiểm tra thực tế chứ không chỉ nới peer range.
- Một maintainer chính (Papooch); issue #12 "Address performance and stability concerns" còn mở từ 2022. **[Suy luận]**: rủi ro bus-factor, nhưng issue Nest 12/Prisma 7 được xử lý trong vài tuần.
- Major mới (`nestjs-cls` 7, `transactional` 4, adapter 2) ra 2026-09-20; xem changelog khi nâng cấp.

## 8. Phương án tự viết (không cần vì tương thích; chỉ để so sánh)

~15 dòng cốt lõi, semantics Required:

```ts
const als = new AsyncLocalStorage<Prisma.TransactionClient>();
@Injectable()
export class TxHost {
  constructor(private readonly prisma: PrismaService) {}
  get tx(): Prisma.TransactionClient | PrismaService {
    return als.getStore() ?? this.prisma;
  }
  run<T>(
    fn: () => Promise<T>,
    opts?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number; maxWait?: number },
  ): Promise<T> {
    if (als.getStore()) return fn(); // Required: nhập vào tx đang có
    return this.prisma.$transaction((tx) => als.run(tx, fn), opts);
  }
}
```

Không có Nested/savepoint, `RequiresNew`, `Mandatory` hay decorator; muốn có phải tự viết thêm.

## 9. Nguồn

- npm registry: `npm view nestjs-cls | @nestjs-cls/transactional | @nestjs-cls/transactional-adapter-prisma` (version, peerDependencies, time).
- Docs: https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional (propagation, default Required); https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional/prisma-adapter (custom client type, `sqlFlavor`).
- Source: `node_modules/@nestjs-cls/transactional-adapter-prisma/dist/esm/lib/transactional-adapter-prisma.js`.
- GitHub: https://github.com/Papooch/nestjs-cls issues #430, #626, #631, #12; releases `nestjs-cls@6.3.0`, `@nestjs-cls/transactional-adapter-prisma@1.3.2`.
- Thử nghiệm: `.claude/worktrees/agent-ae07b085ace2e05b1/probe/` (`test/tx.spec.ts`, `src/app.module.ts`, `src/database/prisma.service.ts`), bỏ đi được.
