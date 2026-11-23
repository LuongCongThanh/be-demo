# Research 10: Kiến trúc tham chiếu cho dự án NestJS

Ticket: `issues/10-nestjs-reference-architectures.md`
Ngày: 2026-11-24
Phạm vi: chỉ nêu sự thật và đánh đổi; **không quyết định thay người dùng**. Quy ước đánh dấu: **[Đã xác minh]** = đọc trực tiếp nguồn chính; **[Suy luận]** = kết luận của người viết, chưa có nguồn xác nhận; **[Chưa xác minh]** = không kiểm tra được.

---

## 1. Tóm tắt cho người ra quyết định

1. Quyết định "một kiến trúc cho mọi module, DB qua Persistence Port, không ngoại lệ" **khớp nhóm Clean/Hexagonal**, và có tiền lệ boilerplate NestJS lớn (brocoders). Nhưng các nguồn uy tín về Hexagonal/DDD **đều tự nói đây là khuyến nghị, không phải luật, và quá mức với CRUD đơn giản** (xem mục 3.2). Quy tắc "không ngoại lệ" là lựa chọn nghiêm ngặt hơn mọi nguồn được khảo sát.
2. Tài liệu chính thức của NestJS (Prisma recipe) inject `PrismaService` thẳng vào service, không có repository. Prisma Client được Prisma tự mô tả là Data Mapper. Repository bọc Prisma vì thế là lựa chọn kiến trúc (testability, tách kiểu ORM), không phải yêu cầu của framework hay ORM.
3. Bộ khung Q12 là **hexagonal theo tầng (layer-first) ở gốc module, rồi tách bề mặt (surface-first) `admin/`, `storefront/`** bên cạnh. Layer-first + surface-first lẫn nhau là điểm lệch lớn nhất so với mọi tham chiếu; không nguồn nào khảo sát dùng cấu trúc này, đây là thiết kế riêng của repo.
4. Điểm đau thực tế nhất của "Persistence Port cho mọi module" là **transaction xuyên nhiều repository với Prisma interactive transaction** (mục 5). Hai cách đã có tiền lệ: method atomic trong repository, hoặc `AsyncLocalStorage` (nestjs-cls transactional).
5. Có thể giữ "một kiến trúc" mà giảm chi phí bằng các biến thể (mục 7): per-module một repository, use-case file thay cho service, gộp `application/` + `ports/`.

---

## 2. Bối cảnh repo (đã đọc code)

| Mục                                      | Hiện trạng                                                                                                                                                                                                                                                                                                                                                                                                      | Nguồn nội bộ                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Category (module duy nhất đã nhiều tầng) | 48 file không tính spec + 13 spec. Có `domain/`, `application/ports/{persistence,storage,translation}`, `application/shared/`, `infrastructure/{persistence/relational,integrations,storage}`, `admin/`, `storefront/`, `presentation/`, `testing/`, `category-core.module.ts`, `category.module.ts`. 3 Symbol token (`CATEGORY_REPOSITORY`, `CATEGORY_TRANSLATION_REPOSITORY`, `CATEGORY_LANGUAGE_REPOSITORY`) | `src/modules/catalog/category/`                                              |
| Cart                                     | 5 file phẳng: controller, module, service (239 dòng), spec, `dto/cart.dto.ts`; module import `PrismaModule`                                                                                                                                                                                                                                                                                                     | `src/modules/cart/`                                                          |
| Checkout                                 | 14 file: `controllers/storefront`, `services/storefront/checkout.service.ts` (537 dòng, gọi `this.prisma.$transaction` ngay trong service), `domain/checkout-pricing.ts`, `dto/storefront`, `security/`                                                                                                                                                                                                         | `src/modules/checkout/`                                                      |
| Outbox                                   | Domain event ghi vào bảng outbox **cùng transaction** với Order và Tồn kho; worker đọc outbox. Chỉ "done" khi downstream xác nhận                                                                                                                                                                                                                                                                               | `docs/adr/0003-*`, `docs/adr/0007-*`                                         |
| Convention Category v1.6                 | Clean Architecture + Repository Pattern; "bắt buộc có Port khi outbound I/O"; `TransactionPort`/`UnitOfWork` chỉ khi nhiều Persistence Port phải atomic (§4.2), propagation qua `AsyncLocalStorage` được nhắc là ví dụ; nested transaction bị từ chối                                                                                                                                                           | `docs/architecture/refactor/01-category-folder-structure-convention-v1.6.md` |

Nguồn gốc `infrastructure/persistence/relational`: tên trùng với brocoders (mục 3.2). **[Suy luận]**: không tài liệu nào trong repo nhắc đến brocoders (đã grep `docs/` và `.claude/`: chỉ có `docs/business/01-vision-scope.md` chứa từ "boilerplate" trong ngữ cảnh khác), nên không có bằng chứng trực tiếp về nguồn gốc. Khác biệt có thật: brocoders tách `document/` vs `relational/` để hỗ trợ hai loại DB; repo này chỉ có Postgres, nên tầng `relational/` hiện không mang lợi ích "đổi DB".

---

## 3. Từng kiến trúc

### 3.1 Layered mặc định NestJS: Controller → Service → ORM

**Ý tưởng chính.** Mỗi feature là một Nest module: controller (HTTP), service (nghiệp vụ + truy cập dữ liệu), module. Nguồn: NestJS Modules doc nói feature module "keeps boundaries clear"; provider private theo mặc định, chỉ provider `exports` mới thành public API của module **[Đã xác minh]** (https://docs.nestjs.com/modules).

**Prisma trong tài liệu NestJS.** Recipe Prisma inject `PrismaService` (extends `PrismaClient`) thẳng vào `UsersService`, gọi `this.prisma.user.findUnique(...)`, "the service is also the place for your business logic"; test mock trực tiếp `PrismaService`; không có repository **[Đã xác minh]** (https://docs.nestjs.com/recipes/prisma). Cũng theo recipe, truyền `tx` qua nhiều service làm "couples your services to one another" và đề xuất plugin transactional của `nestjs-cls` thay thế **[Đã xác minh]**.

**Layout điển hình.**

```
cart/
├── cart.controller.ts
├── cart.service.ts
├── cart.module.ts
└── dto/cart.dto.ts
```

(Đây chính là cart hiện tại.)

| Tiêu chí          | Đánh giá                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ưu                | Ít file, ít indirection, token thấp; khớp tài liệu chính thức; AI agent dễ viết vì mẫu phổ biến nhất trong dữ liệu huấn luyện **[Suy luận]**                               |
| Nhược             | Service phình (checkout.service.ts: 537 dòng); nghiệp vụ lẫn truy cập dữ liệu; unit test phải mock `PrismaService` (mock cấu trúc Prisma phức tạp); không ép ranh giới nào |
| CRUD 4 file       | 4 file (+spec)                                                                                                                                                             |
| Checkout phức tạp | Service lớn; transaction viết trực tiếp với `prisma.$transaction(async (tx) => ...)`; có thể tách thủ công thành helper nhưng không có hướng dẫn                           |
| Prisma            | Khớp tự nhiên                                                                                                                                                              |
| Testability       | Mock `PrismaService`, hoặc test với DB thật; đủ cho CRUD, kém cho nghiệp vụ nhiều nhánh                                                                                    |
| AI-agent          | Token thấp nhất; rủi ro là agent viết logic vào service và lệch convention vì không có ràng buộc cấu trúc                                                                  |

### 3.2 Clean / Hexagonal (Ports & Adapters)

**Ý tưởng chính.** Cockburn: port là "purposeful conversation" của ứng dụng với thế giới ngoài; adapter là code đặc thù công nghệ cắm vào port; mục tiêu ban đầu là để ứng dụng chạy được bởi người dùng, chương trình, test tự động hoặc script, và phát triển/test tách khỏi thiết bị và DB thật **[Đã xác minh]** (https://alistair.cockburn.us/hexagonal-architecture/).

**brocoders/nestjs-boilerplate (tham chiếu NestJS chính cho Hexagonal).**

- Doc kiến trúc nêu mục tiêu: có thể đổi DB hoặc cách upload file mà không đổi business logic. Mỗi feature có `domain/` (entity), `dto/`, `infrastructure/persistence/` (có `document/` cho Mongo và `relational/` cho Postgres, kèm `*.repository.ts` là port), cùng `*.controller.ts`, `*.service.ts`, `*.module.ts` ở cấp feature **[Đã xác minh]** (https://github.com/brocoders/nestjs-boilerplate/blob/main/docs/architecture.md; thư mục `src/users` và `src/users/infrastructure/persistence` đã đối chiếu trên GitHub).
- Port là **abstract class** (`export abstract class UserRepository`), không phải interface + Symbol; service inject bằng chính class đó, không cần `@Inject(token)`. Port chỉ import `User` từ `domain/` **[Đã xác minh]** (https://github.com/brocoders/nestjs-boilerplate/blob/main/src/users/infrastructure/persistence/user.repository.ts).
- Doc khuyến nghị method đơn trách nhiệm (`findByEmail`) hơn một `find` vạn năng **[Đã xác minh]**.
- `UsersService` không dùng transaction nào (không `@Transactional`, không unit of work); nhiều lookup chạy trước write cuối mà không có cơ chế atomic **[Đã xác minh]** (https://github.com/brocoders/nestjs-boilerplate/blob/main/src/users/users.service.ts).
- Không có tầng `application/` tách khỏi service, không tách bề mặt admin/storefront: một controller, một service cho mỗi feature **[Đã xác minh]** (theo danh sách thư mục `src/users`).
- Chưa xác minh tên thư mục con bên trong `relational/` (entities, mappers, repositories). **[Chưa xác minh]**
- Boilerplate dùng TypeORM/Mongoose, không có Prisma **[Chưa xác minh trực tiếp]**; không thấy Prisma trong cây thư mục đã đọc.

**Sairyss/domain-driven-hexagon.** Tài liệu tự nói: "Everything below is provided as a recommendation, not a rule"; "implementing a complete architecture like this is generally ill-suited to simple CRUD applications"; "in real world production applications, you will most likely only need a fraction of those patterns"; tách domain model và persistence model "may be overkill for smaller applications"; về port cho DB: "In practice, it's not always useful... this doesn't mean you should do that too." **[Đã xác minh]** (https://github.com/Sairyss/domain-driven-hexagon; đọc 100.000/121.013 ký tự đầu, phần cuối chưa đọc).

| Tiêu chí          | Đánh giá                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ưu                | Ranh giới rõ; domain thuần test không cần Nest/Prisma; có tiền lệ boilerplate lớn                                                                                                                                  |
| Nhược             | Thêm mapper, port, adapter, token; nguồn chính tự cảnh báo quá mức với CRUD; port "mimic" Prisma API là phản mẫu theo Sairyss ("Ports should be created to fit the Domain needs, not simply mimic the tools APIs") |
| CRUD 4 file       | **[Suy luận, ước lượng]** khoảng 8-10 file: domain model, port, Prisma adapter, mapper (nếu tách persistence record), service/use case, controller, dto, module (+persistence module)                              |
| Checkout phức tạp | Port theo capability (đặt hàng, tồn kho, voucher), cần cách xử lý transaction (mục 5); lợi nhiều hơn CRUD vì có nhiều nhánh nghiệp vụ để test với port giả                                                         |
| Prisma            | Khớp được nhưng kiểu Prisma phải bị chặn ở adapter (Convention v1.6 §2.2 đã quy định); Prisma Client đã là Data Mapper (mục 5)                                                                                     |
| Testability       | Cao nhất trong nhóm không-CQRS: service test bằng fake repository trong bộ nhớ                                                                                                                                     |
| AI-agent          | Nhiều file hơn mỗi tính năng, nhưng quy tắc vị trí file rõ nên agent ít do dự; chi phí token mỗi thay đổi tăng theo số file chạm tới                                                                               |

### 3.3 DDD tactical + CQRS (`@nestjs/cqrs`)

**Ý tưởng chính.** Command (đổi trạng thái) và Query (đọc) tách biệt, đi qua `CommandBus`/`QueryBus` tới handler; aggregate raise event bằng `apply()`; saga phản ứng event và phát command **[Đã xác minh]** (https://docs.nestjs.com/recipes/cqrs). Tài liệu không quy định cây thư mục; ví dụ dùng `kill-dragon.command.ts`, `kill-dragon.handler.ts`, `hero-killed-dragon.event.ts`, `hero.model.ts`, `heroes-game.saga.ts`.

Caveat theo tài liệu NestJS **[Đã xác minh]**:

- Event handler chạy ngoài HTTP request: exception filter không bắt được lỗi, không trả HTTP response.
- Saga chạy trong bộ nhớ, mất việc đang dở khi restart; cần workflow bền cho quá trình phải sống qua restart.
- Handler/saga lỗi không bắt sẽ vào `UnhandledExceptionBus`.
- Sau `commit()` bị lỗi, tài liệu khuyên rollback và chạy lại command với model nạp mới.
- Saga không dùng được request-scoped provider.

Kamil Grzybek: module Meetings dùng CQRS, module Payments dùng Event Sourcing, nên kiểu triển khai khác nhau theo module **[Đã xác minh một phần]**: README chỉ nêu các lựa chọn này cho từng module cụ thể, không tuyên bố rõ nguyên tắc "mỗi module chọn kiểu riêng" (https://github.com/kgrzybek/modular-monolith-with-ddd). Điều này **trái** với quyết định "một kiến trúc, không ngoại lệ" của repo, dù khác chiều (Grzybek đa dạng theo module, repo muốn đồng nhất).

| Tiêu chí          | Đánh giá                                                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ưu                | Tách đọc/ghi sạch; event tích hợp tự nhiên với outbox; handler nhỏ, một việc                                                                                                                                           |
| Nhược             | Nhiều file nhất; gián tiếp qua bus làm khó theo dõi luồng (bước nhảy "tìm handler" cho cả người và agent); event in-memory không thay thế outbox bền (ADR 0003/0007 cần ghi DB cùng transaction); saga mất khi restart |
| CRUD 4 file       | **[Suy luận, ước lượng]** 15-20 file (mỗi thao tác một command + handler, thêm query + handler, aggregate, port, adapter, controller, dto, module)                                                                     |
| Checkout phức tạp | Hợp với đặt hàng nhiều bước, nhưng dòng trong đơn vị transaction vẫn phải ghi outbox, không dựa vào `EventBus` bộ nhớ                                                                                                  |
| Prisma            | Không xung đột nhưng không thêm lợi; query có thể đọc Prisma thẳng (Sairyss cho phép query bỏ qua domain/repository)                                                                                                   |
| Testability       | Handler test riêng rất dễ; đổi lại cần test wiring bus                                                                                                                                                                 |
| AI-agent          | Token cao do số file; agent dễ quên đăng ký handler vào module (lỗi chỉ lộ lúc chạy) **[Suy luận]**                                                                                                                    |

### 3.4 Vertical slice / feature-based

**Ý tưởng chính.** Jimmy Bogard: tổ chức quanh request (use case), không quanh tầng kỹ thuật; "Minimize coupling between slices, and maximize coupling in a slice"; mỗi slice tự chọn cách xử lý (bắt đầu bằng transaction script, refactor khi có smell); ông phê phán quy tắc "controller phải gọi service phải gọi repository" vì tạo trừu tượng thừa. Điều kiện: đội phải hiểu refactoring và code smell **[Đã xác minh]** (https://www.jimmybogard.com/vertical-slice-architecture/). Bài đó nói về domain logic, không bàn riêng data access **[Đã xác minh]**.

Sairyss cũng gọi cấu trúc module của mình là vertical slicing: mỗi use case một thư mục trong module (ví dụ `src/modules/user/commands`) **[Đã xác minh]**. Tức Hexagonal và vertical slice có thể kết hợp.

**Layout NestJS điển hình (chưa có nguồn chuẩn duy nhất, đây là dạng phổ biến [Suy luận]).**

```
cart/
├── add-item/       (controller, handler/service, dto, spec)
├── update-item/
├── remove-item/
└── cart.module.ts
```

| Tiêu chí          | Đánh giá                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ưu                | Thay đổi một tính năng chạm một thư mục; agent chỉ cần đọc một slice; hợp "không tạo abstraction khi chưa cần"                                                                                                                                                     |
| Nhược             | Logic dùng chung giữa slice (checkout dùng giá, voucher, tồn kho) dễ bị nhân bản hoặc dồn vào `shared/`; thiếu ranh giới ép buộc, nên phụ thuộc kỷ luật của người viết (mà Bogard nêu rõ); khác hẳn quyết định "không ngoại lệ" nếu mỗi slice được chọn cách riêng |
| CRUD 4 file       | **[Suy luận, ước lượng]** 8-12 file (4 slice × controller/handler/dto), hoặc 4 file nếu gộp theo feature                                                                                                                                                           |
| Checkout phức tạp | Một slice "place-order" lớn; phần chung (pricing, voucher) vẫn cần chỗ đặt                                                                                                                                                                                         |
| Prisma            | Mỗi slice gọi Prisma trực tiếp là mặc định; tương thích                                                                                                                                                                                                            |
| Testability       | Test theo slice (tích hợp với DB thật), ít mock                                                                                                                                                                                                                    |
| AI-agent          | Ngữ cảnh cục bộ, token thấp mỗi thay đổi; rủi ro lệch convention giữa slice                                                                                                                                                                                        |

### 3.5 Modular monolith (public API, data ownership, outbox)

Đây là thực hành về **ranh giới giữa module**, không phải cách tổ chức bên trong module; kết hợp được với 3.1-3.4.

- Kamil Grzybek, "Modular Monolith: A Primer": module nên phụ thuộc nhau tối thiểu (số lượng, độ mạnh, độ ổn định của dependency); mỗi module là vertical slice cung cấp trọn bộ tính năng; module cần contract/entry point rõ, chỉ chứa thứ client cần; encapsulation là một phần không tách rời của tính module; contract có thể là facade gọi đồng bộ hoặc published event bất đồng bộ **[Đã xác minh]** (https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer). Bài này không bàn data isolation hay kiến trúc riêng từng module **[Đã xác minh]**.
- Repo ví dụ `modular-monolith-with-ddd`: mỗi module có schema DB riêng, "shared data is not allowed", giao tiếp giữa module chỉ qua Events Bus bất đồng bộ ("direct method calls are not allowed"), Outbox/Inbox cho độ tin cậy at-least-once, mỗi module có interface riêng (command/query) cho API và assembly `IntegrationEvents` là phần duy nhất module khác được gọi **[Đã xác minh]** (https://github.com/kgrzybek/modular-monolith-with-ddd; đọc 100.000/104.014 ký tự).
- NestJS: `exports` của module là public API; provider không export thì private **[Đã xác minh]**.

So với repo: ADR 0003/0007 (outbox cùng transaction, ack downstream) khớp hướng Grzybek. Nhưng cart/checkout đọc/ghi bảng của module khác trực tiếp bằng Prisma, và Grzybek cấm sharing dữ liệu giữa module; ticket 06 (`cart-checkout-ownership`) xử lý vấn đề này, nằm ngoài phạm vi ticket 10. **[Suy luận]** chưa kiểm tra toàn bộ code cho quan hệ giữa các module.

| Tiêu chí          | Đánh giá                                                                                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ưu                | Ranh giới module rõ, nền tảng để tách service sau này; outbox đã có ADR                                                                                                                                                                            |
| Nhược             | Ràng buộc "không chia sẻ dữ liệu giữa module" mâu thuẫn với transaction xuyên module hiện có (checkout ghi order + tồn kho + voucher trong một `$transaction`); Grzybek tự nói không thể và không nên có transaction xuyên module trong mô hình đó |
| CRUD 4 file       | Không đổi số file bên trong; thêm facade/`exports` nếu có consumer ngoài                                                                                                                                                                           |
| Checkout phức tạp | Là chỗ căng nhất: hoặc chấp nhận transaction xuyên module (một DB), hoặc chuyển sang saga/outbox giữa module                                                                                                                                       |
| Prisma            | Một schema Prisma chung khó cưỡng chế quyền sở hữu bảng; chỉ cưỡng chế bằng quy ước/lint                                                                                                                                                           |
| AI-agent          | Quy tắc "module nào được import gì" là thứ lint kiểm được (xem ticket 04, 08)                                                                                                                                                                      |

---

## 4. Bảng so sánh tổng hợp

Các số file là **[Suy luận, ước lượng của người viết]**, chưa đo; chúng mô tả bậc độ lớn, không phải số chính xác.

|                                      | 1. Layered mặc định                                | 2. Clean/Hexagonal                                           | 3. DDD + CQRS                       | 4. Vertical slice                 | 5. Modular monolith (ranh giới)                           |
| ------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------- | --------------------------------- | --------------------------------------------------------- |
| Ý chính                              | Controller → Service → ORM                         | Port/adapter, domain không biết hạ tầng                      | Command/Query/Event tách, aggregate | Gom theo use case                 | Module có public API, sở hữu dữ liệu, giao tiếp qua event |
| Tham chiếu                           | docs.nestjs.com Modules, Prisma recipe             | Cockburn, brocoders, Sairyss                                 | docs.nestjs.com CQRS, Sairyss       | Bogard                            | Grzybek, docs.nestjs.com Modules                          |
| CRUD 4 file                          | 4                                                  | ~8-10                                                        | ~15-20                              | ~4-12                             | ~4 (+ facade nếu có consumer)                             |
| Checkout phức tạp                    | Service phình, khó test                            | Port theo capability, test bằng fake, cần cơ chế transaction | Handler nhỏ + outbox bền            | Slice lớn, phần chung khó đặt     | Căng nhất: transaction xuyên module vs saga               |
| Prisma                               | Tự nhiên (đúng recipe)                             | Cần chặn kiểu Prisma ở adapter; lợi ích đổi ORM thấp         | Không thêm lợi                      | Tự nhiên                          | Không cưỡng chế được quyền sở hữu bảng bằng schema chung  |
| Transaction xuyên nhiều thao tác     | `prisma.$transaction` trong service                | Cần Unit of Work / ALS / method atomic ở port                | Handler + outbox                    | `prisma.$transaction` trong slice | Tránh xuyên module                                        |
| Testability                          | Mock Prisma                                        | Fake repository; cao                                         | Cao theo handler                    | Tích hợp theo slice               | Không áp dụng                                             |
| Token/AI-agent                       | Thấp nhất                                          | Trung bình-cao; quy tắc rõ                                   | Cao nhất                            | Thấp, cục bộ                      | Trung lập                                                 |
| Tự nói quá mức với CRUD?             | Không                                              | Có (Sairyss)                                                 | Có (Sairyss)                        | Không; cần kỷ luật                | Không                                                     |
| Khớp "một kiến trúc, không ngoại lệ" | Có (nhưng quyết định hiện tại muốn nhiều tầng hơn) | **Có, đúng hướng**                                           | Có nhưng nặng nhất                  | Có                                | Bổ sung, không thay thế                                   |

---

## 5. Prisma: repository có đáng không, transaction xuyên repository

**Prisma Client là Data Mapper.** Trang so sánh Prisma với TypeORM: Prisma theo "DataMapper ORM pattern rather than Active Record", tạo "lightweight database client that exposes a tailored and fully type-safe API", nhằm tránh "bloated model instances, mixing business with storage logic" **[Đã xác minh]** (https://www.prisma.io/docs/orm/more/comparisons/prisma-and-typeorm). Trang đó không bàn Repository. Trang "Is Prisma an ORM?" mà tìm kiếm trả về không chứa nội dung Data Mapper khi tôi đọc (nó nói về Prisma ORM 8 và `prisma contract emit`, nên khác phiên bản docs đang dùng) **[Chưa xác minh]** ở trang đó.

**Không có nguồn Prisma chính thức yêu cầu repository.** Tìm kiếm không thấy hướng dẫn chính thức của Prisma về repository; chỉ có ý kiến cộng đồng (thảo luận prisma#3929 về generic repository, nhiều skill/hướng dẫn bên thứ ba giữ import Prisma trong file repository). Đây là nguồn thứ cấp, **không dùng làm căn cứ chuẩn** **[Chưa xác minh từ nguồn chính]**.

Lập luận cho repository bọc Prisma (**[Suy luận]**, khớp mục tiêu của Cockburn): giữ kiểu Prisma khỏi tầng nghiệp vụ, tạo seam test, gom query phức tạp (Category có `category-prisma-selects.ts`). Lập luận chống: Prisma Client đã typed và mockable; repository dễ thành wrapper một-một (Convention v1.6 tự cảnh báo, §4.2 "không tạo Port/wrapper riêng cho mỗi method"); thêm mapper giữa record và domain.

**Interactive transaction.** `prisma.$transaction(async (tx) => ...)`: chỉ lời gọi trên `tx` nằm trong transaction; commit khi hàm kết thúc, rollback khi throw; mặc định `maxWait` 2000 ms, `timeout` 5000 ms, `isolationLevel` theo cấu hình DB; docs cảnh báo giữ transaction ngắn, tránh network request và query chậm bên trong; ở `Serializable`, xung đột trả lỗi P2034 và nên có vòng retry **[Đã xác minh]** (https://prisma.io/docs/orm/prisma-client/queries/transactions?view=full).

Hệ quả cho Persistence Port: `tx` là instance Prisma Client, nên không thể đi qua port mà không làm lộ kiểu Prisma (Convention v1.6 cấm điều đó). Các hướng đã có tiền lệ:

| Hướng                                                   | Cách làm                                                                          | Nguồn/tiền lệ                                                                                                                                                                                                                                                                                                 | Đánh đổi                                                                                                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Method atomic trong port                             | Port có method nghiệp vụ (`placeOrder(...)`); adapter mở `$transaction` bên trong | Convention v1.6 §4.2 hình thức 1                                                                                                                                                                                                                                                                              | Đơn giản, không lộ `tx`; nhưng adapter chứa nhiều logic ghi, port phình (v1.6 cảnh báo không biến port thành nơi chứa mọi truy vấn)                                            |
| B. Unit of Work / `TransactionPort` + AsyncLocalStorage | `runInTransaction(work)`; adapter dùng chung context                              | Convention v1.6 §4.2 hình thức 2; plugin `@nestjs-cls/transactional` có `TransactionalAdapterPrisma`, `@Transactional()`, `txHost.tx.user.create(...)`, propagation Required/RequiresNew/Mandatory/Nested... **[Đã xác minh]** (https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional) | Use case sạch; thêm một phụ thuộc hoặc tự viết ALS; plugin tự ghi nhận dùng option adapter trong decorator "leaks implementation details"; nested không hỗ trợ mặc định ở v1.6 |
| C. Truyền `tx` làm tham số                              | Mỗi method repository nhận `tx`                                                   | Prisma recipe nhắc đây là "couples your services to one another" **[Đã xác minh]**                                                                                                                                                                                                                            | Đơn giản nhất, nhưng làm rò rỉ kiểu Prisma qua port, trái quy tắc v1.6                                                                                                         |
| D. Service gọi Prisma trực tiếp trong transaction       | Như checkout hiện tại                                                             | Prisma recipe                                                                                                                                                                                                                                                                                                 | Không có port; trái quyết định "mọi module qua Persistence Port"                                                                                                               |

Outbox (ADR 0003): yêu cầu ghi event **trong cùng transaction** với Order và Tồn kho. Mọi hướng phải để ghi outbox tham gia cùng transaction đó (hướng A: trong method atomic; hướng B: outbox repository dùng cùng context). **[Suy luận]**: đây là lý do một `TransactionPort`/UoW khó tránh khỏi cho checkout nếu giữ port.

---

## 6. Ánh xạ bộ khung Q12 sang các kiến trúc

Bộ khung Q12 (từ ticket 01 §Tiến độ): `domain/`, `application/` (+ `ports/`), `infrastructure/`, `admin/`, `storefront/`, `<module>.module.ts`; thư mục chỉ tạo khi có file.

| Thành phần Q12            | Khớp với                                                                                   | Ghi chú                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `domain/`                 | Hexagonal (domain thuần), brocoders `domain/`, Sairyss                                     | Khớp                                                                                                                                                               |
| `application/` + `ports/` | Clean/Hexagonal (application + port); không có trong brocoders (service nằm ở gốc feature) | Khớp Sairyss/Grzybek (có tầng Application); nặng hơn brocoders                                                                                                     |
| `infrastructure/`         | Hexagonal; brocoders `infrastructure/persistence/`                                         | Khớp; `relational/` thừa nếu chỉ một loại DB **[Suy luận]**                                                                                                        |
| `admin/`, `storefront/`   | **Không khớp tham chiếu nào được khảo sát**                                                | Đây là phân tách theo bề mặt (surface/actor), gần ý "vertical slice theo actor" nhưng vẫn nằm trong cấu trúc layer-first; brocoders dùng một controller cho cả hai |
| `<module>.module.ts`      | NestJS module doc                                                                          | Khớp                                                                                                                                                               |
| Port bắt buộc cho DB      | Hexagonal chặt; Sairyss nói "not always useful"; Prisma recipe không có                    | Nghiêm hơn mọi nguồn                                                                                                                                               |

**Kiểu cấu trúc tổng thể là lai.** Gốc module là layer-first (Hexagonal), còn trong `admin/` và `storefront/` Category lại lặp một bộ nhỏ `application/`, `controllers/`, `dto/`, `presentation/mappers/`. Hệ quả quan sát được trong code Category: hai file mapper cùng tên `category-response.mapper.ts`, hai thư mục `application/`, thêm `application/shared/` để chứa phần dùng chung giữa admin và storefront, và `presentation/` ở gốc. **[Suy luận]** Đây là chi phí điều hướng: một tính năng admin chạm tới `domain/`, `application/ports`, `infrastructure/persistence/relational/adapters`, `admin/application`, `admin/controllers`, `admin/dto`, `admin/presentation`.

**Pitfall đã biết (có nguồn hoặc dấu hiệu trong repo):**

1. Port bắt chước API công cụ: Sairyss cảnh báo ("not simply mimic the tools APIs"). Category repository hiện có kiểu input chi tiết như `CategoryContentUpdate` với `expectedSourceVersion`, `expectedEnglishRevision` (đọc `category.repository.ts`); **[Suy luận]** đó là port theo nhu cầu use case chứ không bắt chước Prisma, nhưng khá rộng với 3 token repository.
2. Persistence record vs domain model: Sairyss nói tách "may be overkill for smaller applications"; Convention v1.6 §2.2 đã nói "chỉ tạo riêng khi khác nghĩa".
3. Rủi ro "wrapper chuyển tiếp" tự v1.6 nêu ở §4.2.
4. Transaction xuyên repository (mục 5).
5. Quy tắc "không ngoại lệ" áp cho cart (5 file, 239 dòng service) sẽ tăng file nhiều lần so với giá trị nghiệp vụ **[Suy luận]**; đây là điểm cần người dùng cân nhắc, không có nguồn nào chỉ hướng.
6. Thư mục tách bề mặt: Convention v1.6 §2 đã đặt điều kiện "nên tách khi use case/API độc lập đáng kể"; Q12 hiện áp cố định cho mọi module, nên với module chỉ có một bề mặt (voucher admin, checkout storefront) `admin/` hay `storefront/` có thể là thư mục duy nhất, thêm một cấp lồng mà không có giá trị phân tách.

---

## 7. Các phương án giữ "một kiến trúc" với chi phí khác nhau

Tất cả giữ: một bộ quy tắc cho mọi module, DB qua Persistence Port, thư mục chỉ tạo khi có file. Số file là **[ước lượng của người viết]**.

### Phương án A: Q12 nguyên trạng (Hexagonal đầy đủ + surface folder)

Giữ `domain/`, `application/` (+ `ports/`), `infrastructure/`, `admin/`, `storefront/`.

```
cart/                                   checkout/
├── domain/                             ├── domain/
│   └── cart.model.ts                   │   ├── checkout-pricing.ts (+spec)
├── application/                        │   └── checkout-errors.ts
│   ├── ports/persistence/              ├── application/
│   │   └── cart.repository.ts          │   ├── ports/
│   └── shared/cart-totals.service.ts   │   │   ├── persistence/order.repository.ts
├── infrastructure/persistence/         │   │   ├── persistence/checkout-quote.repository.ts
│   └── prisma-cart.repository.ts       │   │   └── transaction/transaction.port.ts
├── storefront/                         │   └── shared/...
│   ├── application/cart.service.ts     ├── infrastructure/persistence/
│   ├── controllers/cart.controller.ts  │   ├── prisma-order.repository.ts
│   ├── dto/cart.dto.ts                 │   └── prisma-transaction.adapter.ts
│   └── storefront-cart.module.ts       ├── storefront/
├── cart.module.ts                      │   ├── application/checkout.service.ts
                                        │   ├── controllers/checkout.controller.ts
                                        │   ├── dto/...
                                        │   └── security/optional-customer-auth.guard.ts
                                        └── checkout.module.ts
```

- Ưu: nhất quán với Category đã làm; ranh giới ép được bằng lint; test bằng fake port.
- Nhược: cart từ 5 lên khoảng 8-9 file không tính spec, khoảng 3 cấp thư mục lồng; thư mục `storefront/` chỉ có một bề mặt nên là cấp thừa; checkout cần `TransactionPort` + ALS (mục 5, hướng B).
- Gần nhất với: Clean/Hexagonal của Convention v1.6.

### Phương án B: Hexagonal-lite kiểu brocoders (layer-first, một repository port mỗi module, bề mặt chỉ tách ở controller/dto)

Một Persistence Port mỗi module (abstract class làm token như brocoders), service/use case ở gốc hoặc `application/`, controller tách bề mặt bằng tiền tố file thay vì thư mục.

```
cart/                                   checkout/
├── domain/cart.model.ts                ├── domain/checkout-pricing.ts
├── application/                        ├── application/
│   ├── cart.repository.ts   (port)     │   ├── checkout.repository.ts   (port, method atomic: placeOrder)
│   └── cart.service.ts                 │   └── checkout.service.ts
├── infrastructure/                     ├── infrastructure/
│   └── prisma-cart.repository.ts       │   └── prisma-checkout.repository.ts
├── storefront-cart.controller.ts       ├── storefront-checkout.controller.ts
├── dto/cart.dto.ts                     ├── dto/...
└── cart.module.ts                      └── checkout.module.ts
```

- Ưu: cart khoảng 7 file, ít cấp lồng; một token mỗi module; transaction dùng hướng A (method atomic trong port, hợp quy tắc v1.6 "ưu tiên một persistence operation atomic"); đúng quy tắc "DB qua port".
- Nhược: không còn `admin/`/`storefront/` thư mục (Q5 đã chốt giữ tên `admin/`; phương án này cần xét lại); port của module lớn (Category có 3 token) sẽ phình hoặc phải chia; `placeOrder` atomic đẩy nhiều logic ghi vào adapter, domain khó kiểm hơn; Category hiện tại cần đổi để khớp.
- Gần nhất với: brocoders (đã xác minh một port mỗi feature và abstract class làm token).

### Phương án C: Use-case file theo tính năng + Persistence Port + UoW (vertical slice trong khung Hexagonal)

Mỗi use case một file thay cho service lớn; port và domain dùng chung trong module; transaction qua UoW (ALS).

```
cart/                                   checkout/
├── domain/cart.model.ts                ├── domain/checkout-pricing.ts
├── ports/cart.repository.ts            ├── ports/
├── infrastructure/                     │   ├── order.repository.ts
│   └── prisma-cart.repository.ts       │   ├── checkout-quote.repository.ts
├── use-cases/                          │   └── unit-of-work.port.ts
│   ├── add-cart-item.ts                ├── infrastructure/ (adapters + ALS UoW)
│   ├── update-cart-item.ts             ├── use-cases/
│   └── remove-cart-item.ts             │   ├── create-checkout-quote.ts
├── http/                               │   └── place-cod-order.ts
│   ├── cart.controller.ts              ├── http/ (controller + dto theo bề mặt)
│   └── cart.dto.ts                     └── checkout.module.ts
└── cart.module.ts
```

- Ưu: file nhỏ, agent chỉ đọc use case cần; gần Bogard + Sairyss ("mỗi use case một thư mục"); không cần bus của `@nestjs/cqrs`.
- Nhược: nhiều file hơn B (cart khoảng 8-10 theo số use case); dễ nhân bản phần dùng chung giữa use case; mất mẫu "service" quen thuộc của NestJS; một hệ quy ước mới cần ghi rõ (agent và người đều chưa quen); Category phải đổi nhiều.
- Gần nhất với: Vertical slice trong khung Hexagonal.

**Phương án ngoài khung "một kiến trúc"** (không khuyên, nêu để đối chiếu): Layered mặc định (3.1) cho CRUD đơn giản và Hexagonal cho module phức tạp, đúng tinh thần Bogard/Sairyss ("chọn theo độ phức tạp") nhưng là quyết định mà người dùng đã đảo ngược (Q4+Q6+Q8, ADR 0015 dự kiến).

### So sánh nhanh ba phương án

|                                   | A (Q12)                        | B (brocoders-lite)                             | C (use-case files)         |
| --------------------------------- | ------------------------------ | ---------------------------------------------- | -------------------------- |
| File cart (không tính spec)       | ~8-9                           | ~7                                             | ~8-10                      |
| Cấp lồng tối đa                   | 3-4                            | 2                                              | 2                          |
| Transaction checkout              | UoW/ALS hoặc method atomic     | Method atomic (hướng A mục 5)                  | UoW/ALS                    |
| Chi phí di chuyển Category        | Không đổi                      | Đổi nhiều (bỏ `admin/`, `storefront/` thư mục) | Đổi nhiều                  |
| Khớp quyết định Q5 (giữ `admin/`) | Có                             | Không (phải xét lại)                           | Một phần                   |
| Rủi ro chính                      | Cấp thừa cho module một bề mặt | Port phình ở module lớn                        | Quy ước mới, nhân bản code |

---

## 8. Điểm chưa xác minh

- Tên và nội dung thư mục con của `src/users/infrastructure/persistence/relational` trong brocoders; chỉ xác minh tên `document/`, `relational/`, `user.repository.ts`.
- Việc brocoders dùng Prisma hay không (không thấy trong cây đã đọc; boilerplate này nổi tiếng với TypeORM/Mongoose nhưng không kiểm tra README).
- Phần cuối 21.013 ký tự của README Sairyss, và 4.014 ký tự cuối README Grzybek, chưa đọc.
- Cách viết cụ thể của Grzybek về "mỗi module tự chọn kiến trúc" ngoài ví dụ Meetings (CQRS) và Payments (Event Sourcing); README không nêu thành nguyên tắc.
- Trang "Is Prisma an ORM?" không chứa nội dung Data Mapper khi đọc (trang mô tả Prisma ORM 8); kết luận Data Mapper chỉ dựa trang so sánh Prisma và TypeORM.
- Số liệu số file cho từng kiến trúc là ước lượng.
- Không đọc toàn bộ code các module khác (voucher, inventory, identity) để kiểm tra mức độ cross-module Prisma access.

---

## 9. Nguồn

Chính thức / tác giả gốc:

- NestJS Modules: https://docs.nestjs.com/modules
- NestJS CQRS recipe: https://docs.nestjs.com/recipes/cqrs
- NestJS Prisma recipe: https://docs.nestjs.com/recipes/prisma
- Prisma transactions: https://prisma.io/docs/orm/prisma-client/queries/transactions?view=full
- Prisma vs TypeORM (Data Mapper): https://www.prisma.io/docs/orm/more/comparisons/prisma-and-typeorm
- Cockburn, Hexagonal architecture: https://alistair.cockburn.us/hexagonal-architecture/
- Bogard, Vertical Slice Architecture: https://www.jimmybogard.com/vertical-slice-architecture/
- Grzybek, Modular Monolith primer: https://www.kamilgrzybek.com/blog/posts/modular-monolith-primer

Repo tham chiếu:

- brocoders/nestjs-boilerplate: https://github.com/brocoders/nestjs-boilerplate (docs/architecture.md, `src/users/infrastructure/persistence/user.repository.ts`, `src/users/users.service.ts`)
- Sairyss/domain-driven-hexagon: https://github.com/Sairyss/domain-driven-hexagon
- kgrzybek/modular-monolith-with-ddd: https://github.com/kgrzybek/modular-monolith-with-ddd
- nestjs-cls transactional plugin: https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional

Nội bộ repo:

- `docs/plan/wayfinding/src-wide-architecture-standard/issues/10-nestjs-reference-architectures.md`, `issues/01-canonical-standard-documents.md`
- `docs/architecture/refactor/01-category-folder-structure-convention-v1.6.md`
- `docs/adr/0003-inventory-reservations-and-transactional-outbox.md`, `docs/adr/0007-outbox-done-means-downstream-ack.md`
- `src/modules/catalog/category/`, `src/modules/cart/`, `src/modules/checkout/`

Nguồn thứ cấp chỉ dùng để ghi nhận ý kiến cộng đồng, không làm căn cứ: Prisma discussion #3929 về generic repository (tìm thấy qua tìm kiếm, không đọc trực tiếp).
