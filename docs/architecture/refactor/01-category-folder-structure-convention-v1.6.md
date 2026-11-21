# Category Folder Structure Convention

**Phiên bản:** 1.6
**Phạm vi:** NestJS `category` module
**Trạng thái:** Proposed
**Mục tiêu:** Chuẩn hóa vị trí file, trách nhiệm từng tầng, quy tắc phụ thuộc và cách tổ chức code cho module Category theo Clean Architecture kết hợp Repository Pattern.

---

## 1. Mục tiêu và phạm vi áp dụng

Tài liệu này quy định cách tổ chức source code của module `category`.

Mục tiêu:

1. Giúp developer xác định đúng vị trí của một file mới.
2. Phân định rõ trách nhiệm giữa Domain, Application, Presentation và Infrastructure.
3. Kiểm soát chiều phụ thuộc, tránh để nghiệp vụ phụ thuộc trực tiếp vào framework hoặc công nghệ lưu trữ.
4. Giữ cấu trúc đơn giản, chỉ tạo folder hoặc abstraction khi có nhu cầu thực tế.
5. Tạo nền tảng để đánh giá và chuẩn hóa các module khác sau khi Category được áp dụng ổn định.

Tài liệu này không yêu cầu mọi folder trong cây tham chiếu phải được tạo sẵn. Chỉ tạo folder khi có file thực tế cần đặt vào đó.

## 2. Nguyên tắc thiết kế

1. Mỗi folder phải có trách nhiệm rõ ràng và có thể giải thích được.
2. Không tạo folder rỗng để dự phòng.
3. Domain không phụ thuộc NestJS, Prisma, HTTP, Storage hoặc dịch vụ bên ngoài.
4. Application chứa use case/service và các Port mà Application cần.
5. Infrastructure triển khai Port bằng công nghệ cụ thể như Prisma hoặc HTTP client.
6. Controller là HTTP adapter: nhận request, gọi Application và trả response.
7. DTO là hợp đồng ở ranh giới API, không phải Domain Model hoặc Prisma Model.
8. Presentation chịu trách nhiệm chuyển dữ liệu Application thành định dạng giao tiếp/API.
9. Không tạo abstraction, mapper, interface hoặc service nếu chưa có nhu cầu thực tế.
10. Không di chuyển code chỉ để làm cho cây thư mục trông giống một mẫu kiến trúc.
11. Test riêng của một thành phần nên đặt gần thành phần đó; chỉ đưa helper dùng chung vào `testing/`.
12. Khi refactor cấu trúc, mặc định phải giữ nguyên hành vi nghiệp vụ.
13. Nên tách application surface Admin và Storefront thành các NestJS module riêng khi use case/API của chúng độc lập đáng kể.
14. Admin và Storefront không được phụ thuộc trực tiếp vào service của nhau; capability dùng chung đặt tại Domain hoặc `application/shared/`.
15. Không nhân đôi Domain, Application Port hoặc Infrastructure chỉ để tách Admin và Storefront.

### 2.1. Mức độ bắt buộc của quy tắc

Các từ khóa trong tài liệu được hiểu như sau:

- **Bắt buộc (MUST):** phải tuân thủ; ngoại lệ cần được review và ghi rõ lý do.
- **Nên (SHOULD):** lựa chọn mặc định; có thể khác đi khi có lý do kỹ thuật/nghiệp vụ hợp lý.
- **Có điều kiện (CONDITIONAL):** chỉ áp dụng khi tình huống được nêu thực sự tồn tại.
- Trong các quy tắc, “phải/bắt buộc/không được” biểu thị MUST; “nên” biểu thị SHOULD; “có thể” nêu một lựa chọn được phép. Nếu một điều kiện là tiêu chí chặn review hoặc Definition of Done, phải ghi rõ là MUST hoặc thể hiện rõ bằng “phải/không được”.
- Bảng trách nhiệm, ví dụ và cây thư mục mô tả phạm vi/ý nghĩa; chúng không tự biến mọi ví dụ thành yêu cầu bắt buộc.

### 2.2. Phân biệt các dạng dữ liệu

Không dùng lẫn ba nhóm dữ liệu sau:

| Dạng dữ liệu | Quyền sở hữu | Mục đích | Ví dụ |
|---|---|---|---|
| **Domain Model** | `domain/` | Biểu diễn khái niệm/trạng thái và quy tắc thuộc nghiệp vụ; không phụ thuộc database hoặc API | `Category` trong `category.model.ts` |
| **Application Result** | `application/` (thường là kiểu export từ use case/service) | Hợp đồng đầu ra của use case, chứa dữ liệu mà caller cần; không phải HTTP DTO và không chứa kiểu Prisma | `GetCategoryResult`, `CategorySummaryResult` |
| **Persistence Record** | `infrastructure/persistence/` | Biểu diễn dữ liệu theo schema/cách lưu trữ, có thể mang field hoặc kiểu riêng của Prisma/database | `CategoryPersistenceRecord` hoặc Prisma model |

Quy tắc:

- Tên `category-record.ts` cũ không được hiểu là persistence record chỉ vì có từ `record`. Khi đặt trong `domain/models/`, nội dung của nó phải là Domain Model thuần; vì vậy cấu trúc đích dùng tên rõ nghĩa hơn là `category.model.ts`.
- Persistence Record chỉ tồn tại trong Infrastructure. Không để Prisma Model hoặc Persistence Record đi qua Application Port, Application Result hay Response DTO.
- Application Result thuộc Application; Presentation/controller có thể đọc nó nhưng không biến nó thành hợp đồng HTTP.
- Response DTO thuộc `dto/` và chỉ mô tả hợp đồng API. Không dùng DTO làm Domain Model hoặc Application Result.
- Chỉ tạo riêng từng kiểu khi chúng có ý nghĩa hoặc cấu trúc khác nhau. Không nhân bản kiểu dữ liệu nếu cùng một kiểu thuần có thể đáp ứng đúng boundary mà không làm rò rỉ dependency.

## 3. Cấu trúc thư mục tham chiếu

Cây dưới đây là cấu trúc mục tiêu tham khảo, không phải danh sách folder bắt buộc.

```text
category/
├── domain/
│   ├── models/
│   │   └── category.model.ts
│   ├── tree/
│   │   ├── category-tree.ts
│   │   └── category-tree.spec.ts
│   ├── localization/
│   │   └── category-locale.ts
│   ├── image/
│   │   ├── category-image.constants.ts
│   │   └── category-image-slot.enum.ts
│   └── errors/
│       └── category-errors.ts
│
├── application/
│   ├── ports/
│   │   ├── persistence/
│   │   │   └── category.repository.ts
│   │   └── translation/
│   │       └── category-translation.port.ts
│   └── shared/
│       └── localization/
│           ├── category-language.service.ts
│           └── category-language.service.spec.ts
│
├── infrastructure/
│   ├── integrations/
│   │   └── translation/
│   │       └── category-translation.client.ts
│   └── persistence/
│       └── relational/
│           ├── category-relational-persistence.module.ts
│           ├── queries/
│           │   └── category-prisma-selects.ts
│           └── adapters/
│               ├── prisma-category.repository.ts
│               └── prisma-category-translation.persistence.ts
│
├── testing/
│   └── category-test-setup.ts
│
├── admin/
│   ├── admin-category.module.ts
│   ├── application/
│   │   ├── category/admin-category.service.ts
│   │   ├── image/admin-category-image.service.ts
│   │   └── translation/admin-category-translation.service.ts
│   ├── controllers/
│   │   ├── admin-category.controller.ts
│   │   ├── admin-category-image.controller.ts
│   │   └── admin-category-language.controller.ts
│   ├── dto/
│   │   ├── category/
│   │   ├── image/
│   │   └── localization/
│   └── presentation/mappers/
│
├── storefront/
│   ├── storefront-category.module.ts
│   ├── application/category/category.service.ts
│   ├── controllers/
│   │   ├── category.controller.ts
│   │   └── category-language.controller.ts
│   ├── dto/category/
│   └── presentation/mappers/
│
├── category-core.module.ts
└── category.module.ts
```

**Lưu ý:**

- Cây trên thể hiện các nhóm có thể tồn tại trong module; không bắt buộc tạo đủ ngay từ đầu.
- Các file `*.spec.ts` nên đặt cạnh file được kiểm thử.
- Nếu dự án có quy ước test khác đã được áp dụng thống nhất, giữ theo quy ước của dự án.
- Domain Model trong cây tham chiếu được đặt tên `category.model.ts`; không đổi tên nó thành Entity chỉ vì lựa chọn folder/file. Chỉ dùng `entities/` khi mô hình thực sự có đặc điểm và hành vi của Entity.

## 4. Trách nhiệm từng tầng

### 4.1. `domain/` — Quy tắc nghiệp vụ cốt lõi

Chứa mô hình, kiểu dữ liệu, quy tắc và logic nghiệp vụ độc lập với framework và công nghệ lưu trữ.

| Folder | Trách nhiệm | Ví dụ |
|---|---|---|
| `models/` | Mô hình dữ liệu thuộc Domain, không phải bản ghi database | `category.model.ts` |
| `tree/` | Logic dựng cây, kiểm tra quan hệ cây và điều kiện hiển thị theo tổ tiên | `category-tree.ts` |
| `localization/` | Locale hợp lệ và quy tắc locale thuần nghiệp vụ | `category-locale.ts` |
| `image/` | Quy tắc, slot và hằng số nghiệp vụ của ảnh | `category-image-slot.enum.ts` |
| `errors/` | Lỗi nghiệp vụ có ý nghĩa trong miền Category | `category-errors.ts` |

**Không đặt tại Domain:**

- NestJS decorator hoặc provider.
- Prisma Client, Prisma Model, query hoặc transaction API.
- HTTP request/response, status code.
- API client, SDK hoặc code gọi nhà cung cấp bên ngoài.
- Upload hoặc thao tác Storage cụ thể.

Domain có thể định nghĩa lỗi nghiệp vụ và kiểu dữ liệu riêng. Việc ánh xạ lỗi sang HTTP response thuộc ranh giới Presentation/HTTP phù hợp của dự án.

### 4.2. `application/` — Use case và điều phối nghiệp vụ

Application điều phối các bước để thực hiện một mục tiêu nghiệp vụ. Application sử dụng Domain và các Port, không phụ thuộc adapter cụ thể.

#### `application/ports/`

Port là hợp đồng mô tả khả năng mà Application cần từ một dependency nằm ngoài Application.

| Folder | Trách nhiệm |
|---|---|
| `persistence/` | Hợp đồng đọc/ghi dữ liệu; có thể bao gồm transaction capability khi use case cần phối hợp nhiều thao tác persistence |
| `transaction/` (chỉ khi cần) | Hợp đồng điều phối một transaction qua nhiều persistence Port |
| `translation/` | Hợp đồng yêu cầu dịch thuật hoặc giao tiếp với khả năng dịch bên ngoài |
| `storage/` (chỉ khi cần) | Hợp đồng lưu trữ/truy xuất/xóa tài nguyên bên ngoài khi Application cần capability storage riêng |

Quy tắc:

- Port chỉ mô tả điều Application cần; không chứa Prisma Client hoặc HTTP SDK.
- Đặt tên theo khả năng/hợp đồng, không gắn tên nhà cung cấp cụ thể.
- Chỉ khai báo phương thức mà use case thực sự cần.
- Không biến một Repository Port thành nơi chứa mọi truy vấn có thể tưởng tượng cho Category.
- **Bắt buộc có Port** khi Application cần thực hiện outbound I/O hoặc gọi capability do Infrastructure sở hữu (database, storage, message broker, HTTP/provider client...) và Application không được phụ thuộc trực tiếp vào API/công nghệ triển khai đó.
- Các dấu hiệu sau giúp thiết kế Port có giá trị và xác định phạm vi Interface phù hợp; chúng không phải điều kiện để cho phép Application phụ thuộc trực tiếp vào Infrastructure:
  1. Port cô lập Application khỏi framework, SDK, ORM, protocol hoặc vendor-specific API có khả năng thay đổi.
  2. Port tạo một seam có ý nghĩa để kiểm thử Application mà không cần khởi tạo hạ tầng thật.
  3. Port biểu đạt một capability có hợp đồng ổn định, được nhiều use case dùng hoặc có implementation có thể thay thế.
  4. Port gom các thao tác có cùng trách nhiệm và transaction/lifecycle boundary thành một Interface dễ hiểu.
- Với outbound I/O, **bắt buộc giữ Port** để Application không phụ thuộc trực tiếp vào Infrastructure. Thiết kế Port theo capability/use case mà Application cần; không tạo một Port/wrapper riêng cho mỗi class hoặc method hay một lớp Application chỉ chuyển tiếp lời gọi.
- Nếu một thao tác có vẻ chỉ phản chiếu một lời gọi một-một, xem xét gộp nó vào Port có capability phù hợp. Adapter vẫn có thể thực hiện lời gọi công nghệ cụ thể khá trực tiếp nếu Port tạo seam kiểm thử, cô lập công nghệ hoặc biểu đạt capability có ý nghĩa. Không loại bỏ Port cần thiết cho outbound I/O chỉ vì implementation hiện tại chỉ có một adapter.
- Domain function thuần, logic nội bộ Application và helper không thực hiện outbound I/O không cần Port.
- Nếu dependency là thư viện thuần, deterministic, không mang I/O/framework/provider detail và không thuộc implementation Infrastructure, không cần bọc nó bằng Port chỉ để tuân thủ hình thức.
- Nếu Storage capability đã được cung cấp qua một Port/module dùng chung phù hợp, không tạo wrapper trùng lặp trong Category chỉ để phản chiếu lại capability đó. Nếu Category thực sự sở hữu một capability storage riêng, mới khai báo Port và adapter tương ứng.

**Quy tắc kiểu dữ liệu của Persistence Port:**

- Input/output của Persistence Port có thể sử dụng kiểu do Domain/Application sở hữu, kiểu nguyên thủy (`string`, `number`, `boolean`) và kiểu chuẩn trung lập của ngôn ngữ/runtime (ví dụ `Date` hoặc `Uint8Array` khi phù hợp).
- Không khai báo Prisma Model, Prisma Client, Persistence Record hoặc kiểu dữ liệu phụ thuộc ORM/database trong Port contract.
- Với thao tác đọc/ghi một Domain Model, Repository Port có thể sử dụng Domain Model làm kiểu dữ liệu phù hợp.
- Với truy vấn phục vụ một use case cụ thể, Port có thể sử dụng Application-defined projection/read model nếu việc trả về toàn bộ Domain Model là không cần thiết.
- Kiểu dữ liệu phục vụ projection/read model phải được định nghĩa ở Application boundary; không lấy trực tiếp kiểu dữ liệu từ Persistence layer.

#### Biểu đạt transaction ở Application

Application xác định **đơn vị nghiệp vụ cần atomic**, còn Infrastructure quyết định cách thực thi bằng database/ORM cụ thể. Chọn một trong hai hình thức sau theo phạm vi thao tác:

1. **Một persistence operation có tính nguyên tử:** nếu toàn bộ thay đổi thuộc một capability/repository và có thể được diễn đạt thành một thao tác có ý nghĩa nghiệp vụ, khai báo một method ở Persistence Port (ví dụ `moveCategory(...)`) và để adapter thực hiện transaction nội bộ. Đây là lựa chọn ưu tiên vì không làm Application biết chi tiết transaction.
2. **Nhiều Persistence Port cần phối hợp:** khi một use case phải gọi nhiều repository/adapter và các thay đổi phải commit/rollback cùng nhau, khai báo một `TransactionPort`/`UnitOfWork` ở Application. Use case gọi `transactionPort.runInTransaction(async () => { ... })` rồi thực hiện các lời gọi Port bên trong callback.

Hợp đồng hành vi tối thiểu của `TransactionPort`:

- Chỉ dùng cho transaction thuộc cùng một transaction manager/database boundary mà Infrastructure có thể bảo đảm tính atomic.
- Hợp đồng tối thiểu có dạng `runInTransaction<T>(work: () => Promise<T>): Promise<T>`; không expose `Prisma.TransactionClient`, ORM session hoặc API database cụ thể qua Port.
- Adapter gọi `work` đúng một lần theo mặc định. Không tự động chạy lại callback khi gặp lỗi serialization/deadlock; nếu cần retry, phải đặc tả rõ hợp đồng retry và bảo đảm callback an toàn khi chạy lại.
- Nếu `work` hoàn tất thành công, adapter commit và trả lại đúng kết quả của `work`. Nếu commit thất bại, phải reject với lỗi commit; không được trả kết quả của `work` như thể transaction đã thành công.
- Nếu `work` throw/reject, adapter phải rollback toàn bộ thay đổi thuộc transaction đó rồi reject lại; không được nuốt lỗi hoặc trả kết quả thành công giả.
- Nếu rollback cũng thất bại, adapter phải giữ được lỗi gốc của `work` làm nguyên nhân chính và bổ sung thông tin lỗi rollback theo cơ chế logging/error-cause của dự án; không được âm thầm thay lỗi nghiệp vụ/kỹ thuật ban đầu bằng lỗi rollback.
- Khi `runInTransaction()` bắt đầu callback, Infrastructure phải thiết lập transaction context cho toàn bộ async execution chain thuộc callback đó; các Persistence Adapter trong execution chain phải nhận diện và sử dụng cùng context.
- Transaction context phải được cô lập giữa các lần gọi chạy đồng thời và được dọn sau khi transaction kết thúc, kể cả khi commit hoặc rollback thất bại. Thao tác bên ngoài callback không được tiếp tục sử dụng context cũ.
- Cách propagation là chi tiết Infrastructure. Có thể dùng `AsyncLocalStorage` hoặc cơ chế tương đương nếu bảo đảm propagation, isolation và cleanup. Không expose transaction context/ORM client qua Application Port, cũng không lưu transaction đang hoạt động trong biến mutable dùng chung ở singleton hoặc global scope.
- Các adapter tham gia phải dùng chung transaction context do Infrastructure quản lý; không được âm thầm mở transaction độc lập. Mọi thao tác đọc/ghi cần tham gia transaction phải thực sự chạy trên context này.
- `work` phải chờ hoàn tất mọi thao tác thuộc transaction trước khi resolve/reject; không tạo fire-and-forget task sử dụng transaction context sau khi callback kết thúc.
- **Nested transaction không được hỗ trợ mặc định.** Gọi `runInTransaction` khi đã ở trong transaction context phải bị từ chối rõ ràng, trừ khi dự án chủ động đặc tả và kiểm thử semantics khác. Không tự giả định nested call tạo savepoint hoặc transaction độc lập.
- Không gọi HTTP/provider, gửi email, upload storage hoặc chạy tác vụ chậm bên trong database transaction. Với phối hợp database và hệ thống ngoài, dùng trạng thái trung gian/outbox/saga hoặc cơ chế nhất quán phù hợp nếu nghiệp vụ yêu cầu.
- Không tạo `TransactionPort` nếu một persistence operation đã đủ để giữ atomicity.
- Transaction Port, nếu tồn tại, là outbound Port nên adapter phải được kết nối bằng DI như các Port khác.

#### Application services theo surface

Use case theo từng surface được đặt trong `admin/application/` hoặc `storefront/application/`; chỉ Application logic thực sự dùng chung mới nằm trong `application/shared/`.

| Folder | Trách nhiệm |
|---|---|
| `admin/application/category/` | Use case quản trị Category: tạo, sửa, liệt kê, xóa, kiểm tra slug và quan hệ cây |
| `admin/application/image/` | Use case quản trị hình ảnh Category |
| `admin/application/translation/` | Use case quản trị nội dung/bản dịch và yêu cầu dịch lại |
| `application/shared/localization/` | Nghiệp vụ locale thực sự dùng chung trong phạm vi Category |
| `storefront/application/category/` | Use case truy vấn Category công khai theo locale và điều kiện hiển thị |

**Quy tắc tổ chức Service và Use Case:**

- Có thể giữ nhiều thao tác liên quan trong một Service khi chúng có cùng trách nhiệm, cùng nhóm thay đổi và vẫn dễ hiểu/kiểm thử.
- Xem xét tách thành service hoặc use case riêng khi một class có nhiều nhóm trách nhiệm độc lập, nhiều dependency không liên quan hoặc thay đổi thường xuyên vì các lý do khác nhau.
- Không bắt buộc mỗi endpoint phải có một Service riêng.
- Không tách class chỉ để giảm số dòng code.
- Nếu sau này chuyển sang `use-cases/`, phải có lý do thực tế và áp dụng nhất quán; không cần đổi cấu trúc hiện tại chỉ vì lựa chọn tên folder.

**Quy tắc `shared/`:**

- `shared/` chỉ có nghĩa là dùng chung trong phạm vi module Category.
- Chỉ đưa code vào `shared/` khi có ít nhất hai nhóm nghiệp vụ trong module thực sự dùng chung cùng một logic/khái niệm.
- Không dùng `shared/` làm nơi chứa code chưa biết đặt ở đâu.
- Không đưa logic riêng của Admin hoặc Storefront vào `application/shared/`.
- Không suy luận rằng code trong `application/shared/` mặc nhiên dùng chung toàn hệ thống.

### 4.3. `controllers/` — HTTP adapter

Controller thuộc surface tương ứng: `admin/controllers/` hoặc `storefront/controllers/`; không đăng ký controllers của cả hai surface tại một module duy nhất.

| Folder | Trách nhiệm |
|---|---|
| `admin/controllers/` | Endpoint dành cho quản trị viên |
| `storefront/controllers/` | Endpoint công khai dành cho người dùng |

Controller chịu trách nhiệm:

- Routing và binding request.
- Áp dụng guard/interceptor phù hợp.
- Nhận DTO và validation tại biên API.
- Gọi Application Service/use case.
- Trả kết quả theo hợp đồng API.

Controller không nên:

- Chứa truy vấn database.
- Chứa quy tắc nghiệp vụ phức tạp.
- Gọi Prisma trực tiếp.
- Tự điều phối transaction nghiệp vụ.
- Triển khai logic mapping phức tạp hoặc lặp lại; controller vẫn có thể thực hiện/ghép các phép chuyển đổi thuần và đơn giản khi cách viết đó rõ ràng.

### 4.4. `dto/` — Hợp đồng API

DTO thuộc surface sở hữu hợp đồng API đó; cây tham chiếu không tạo một thư mục DTO dùng chung ở root.

| Folder | Trách nhiệm |
|---|---|
| `admin/dto/category/` | Request/response cho CRUD và quản trị Category |
| `admin/dto/image/` | Request/response cho thao tác ảnh quản trị |
| `admin/dto/localization/` | Request/response cấu hình ngôn ngữ |
| `storefront/dto/category/` | Query/response dành cho API công khai |

Quy tắc:

- DTO mô tả dữ liệu đi qua ranh giới API.
- Có thể chứa validation decorator của class-validator/class-transformer nếu dự án sử dụng.
- Không dùng DTO làm kiểu dữ liệu nội bộ xuyên suốt Domain và Persistence.
- Không trả Prisma Model trực tiếp cho client.
- DTO Storefront chỉ chứa dữ liệu thuộc hợp đồng công khai.
- Không chia sẻ DTO xuyên Admin/Storefront chỉ vì chúng có cấu trúc field giống nhau; chỉ tạo hợp đồng dùng chung khi ngữ nghĩa và boundary thực sự giống nhau.

### 4.5. `presentation/` — Chuyển đổi dữ liệu phục vụ giao tiếp

`admin/presentation/mappers/` và `storefront/presentation/mappers/` chứa mapper thuần chuyển Application Result thành Response DTO của surface tương ứng. Mapper thuộc Presentation vì đích chuyển đổi là hợp đồng API.

**Controller là nơi gọi mapper** sau khi Application Service/use case trả kết quả. Application không import, inject hoặc gọi Presentation Mapper; Application cũng không trả về Response DTO.

Ví dụ luồng:

```text
HTTP Request
    |
    v
Controller
    |
    +---- gọi ----> Application Service
                         |
                         v
                  Application Result
                         |
                         +---- trả về Controller
                                      |
                                      v
                             Presentation Mapper
                                      |
                                      v
                                Response DTO
                                      |
                                      v
                              HTTP Response
```

Application Result là kiểu đầu ra do Application sở hữu và định nghĩa gần use case/service cần nó. Controller chuyển kết quả đó thành Response DTO; mapping phức tạp nên được tách khỏi controller, còn các phép chuyển đổi thuần và đơn giản có thể được ghép trực tiếp tại controller.

Quy tắc:

- Mapper ở Presentation không phụ thuộc Prisma Model, Prisma Client hoặc Persistence Record.
- Mapper không truy vấn database và không chứa quy tắc nghiệp vụ.
- Mapping từ Persistence Record sang Domain Model/Application-facing data thuộc Infrastructure/Persistence.
- Controller gọi mapper sau khi nhận Application Result; mapper không được gọi ngược Application Service.
- Mapper nên là function/class thuần, không cần DI nếu không có dependency thực sự.
- Không tạo mapper nếu phép chuyển đổi đơn giản và có thể viết rõ ràng ngay tại controller mà không làm controller phình to. Controller có thể ghép các phép chuyển đổi thuần, đơn giản; tách mapper khi việc mapping có nhiều nhánh, được dùng lại hoặc làm controller khó đọc/kiểm thử. Không đẩy điều phối nghiệp vụ vào mapper.

### 4.6. `infrastructure/` — Adapter công nghệ cụ thể

| Folder | Trách nhiệm |
|---|---|
| `integrations/translation/` | Client giao tiếp với nhà cung cấp/dịch vụ dịch thuật |
| `persistence/relational/queries/` | Prisma select/include hoặc cấu hình truy vấn dùng chung |
| `persistence/relational/adapters/` | Hiện thực Repository Port bằng Prisma |
| `persistence/relational/` | Module đăng ký dependency công nghệ và export các adapter persistence cụ thể cần thiết |
| `storage/` (chỉ khi cần) | Adapter hiện thực Storage Port riêng của Category, nếu có |

Quy tắc:

- Adapter triển khai Port đã khai báo ở Application.
- Chỉ Infrastructure được làm việc trực tiếp với Prisma Client hoặc SDK/HTTP client cụ thể.
- Module Infrastructure đăng ký dependency công nghệ và export adapter cụ thể cần dùng; không tự bind token của Application Port.
- Mapping từ dữ liệu database sang kiểu dữ liệu mà Application sử dụng thuộc adapter hoặc mapper nội bộ Infrastructure.
- Chuyển đổi lỗi kỹ thuật tại boundary phù hợp; không để chi tiết Prisma/provider lan vào Domain.
- Chỉ thêm `persistence/document/`, `persistence/cache/`, `storage/` hoặc adapter khác khi có triển khai thực tế và capability chưa được cung cấp bởi một boundary dùng chung phù hợp.

### 4.7. `testing/` — Test helper dùng chung

Chứa fixture, factory, helper hoặc cấu hình test được nhiều test trong Category sử dụng.

- Test riêng của class/function đặt cạnh file được kiểm thử dưới dạng `*.spec.ts`.
- Không đưa mọi test vào `testing/` nếu điều đó làm test xa code cần kiểm tra.
- Không đặt logic production trong thư mục testing.
- Helper dùng chung phải có tên và trách nhiệm cụ thể.

### 4.8. `category.module.ts` — Composition Root

Category được lắp ghép qua các module có ranh giới riêng:

| Module | Trách nhiệm |
|---|---|
| `CategoryCoreModule` (`category-core.module.ts`) | Import persistence Infrastructure module; bind Application Port token sang concrete adapter; export các Port/provider dùng chung cần thiết; đăng ký shared Application provider nếu có |
| `AdminCategoryModule` (`admin/admin-category.module.ts`) | Import trực tiếp `CategoryCoreModule`; đăng ký Admin controllers và Application providers |
| `StorefrontCategoryModule` (`storefront/storefront-category.module.ts`) | Import trực tiếp `CategoryCoreModule`; đăng ký Storefront controllers và Application providers |
| `CategoryModule` (`category.module.ts`) | Chỉ aggregate `AdminCategoryModule` và `StorefrontCategoryModule`; không thay thế việc từng surface import `CategoryCoreModule` |

`CategoryRelationalPersistenceModule` thuộc Infrastructure và đăng ký/export Prisma Client cùng concrete persistence adapter. Binding Port-to-adapter thuộc `CategoryCoreModule`, không thuộc Persistence module hoặc aggregate `CategoryModule`.

NestJS provider chỉ khả dụng qua module visibility: module tiêu thụ phải import module export provider đó. Không giả định provider được chia sẻ tự động giữa Admin và Storefront chỉ vì cả hai được import bởi `CategoryModule`.

Không đặt logic nghiệp vụ trong module.

## 5. Quy tắc Dependency Injection Token

Khi một Port được khai báo, adapter triển khai Port đó **bắt buộc** được kết nối qua token hoặc cơ chế DI phù hợp với dự án. Token-to-adapter binding thuộc `CategoryCoreModule`; Infrastructure module chỉ cung cấp/export dependency công nghệ và adapter cụ thể. Quy tắc này không có nghĩa mọi class đều phải có Port/adapter; quyết định có tạo Port hay không tuân theo mục `application/ports/` ở trên.

Ví dụ minh họa:

```typescript
export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
```

Đăng ký tại module:

```typescript
{
  provide: CATEGORY_REPOSITORY,
  useExisting: PrismaCategoryRepository,
}
```

Trong ví dụ này, Infrastructure module đăng ký và export `PrismaCategoryRepository`; `CategoryCoreModule` bind token Port sang adapter đã export. Không bind cùng Port ở cả Infrastructure module và `CategoryCoreModule`.

Quy tắc:

1. Application không import adapter chỉ để lấy token.
2. Token phải có tên thể hiện rõ Port mà nó đại diện.
3. Chọn một cách quản lý token nhất quán trong module.
4. Nếu số lượng token ít, có thể đặt cạnh Port; nếu nhiều, có thể gom trong file token riêng.
5. Không tạo file token riêng cho từng Port nếu việc đó chỉ làm tăng số file mà không cải thiện khả năng tìm kiếm.
6. Không dùng string token tùy tiện ở nhiều nơi nếu có nguy cơ sai khác hoặc trùng tên.
7. Khi sử dụng `useExisting`, concrete adapter phải được đăng ký provider và export từ Infrastructure module được import. Không đăng ký thêm một instance khác của cùng adapter tại `CategoryCoreModule` chỉ để phục vụ cùng Port token.
8. Admin và Storefront import `CategoryCoreModule` trực tiếp; không phụ thuộc vào provider visibility ngầm từ aggregate `CategoryModule`.

Ví dụ trên chỉ minh họa cách kết nối, không bắt buộc dự án phải dùng `Symbol`.

## 6. Quy tắc chiều phụ thuộc

Luồng khái quát:

```text
Controller / Request DTO
       |
       v
Application Service -----> Domain
       |
       +-----> Application Port <----- Infrastructure Adapter
       |
       v
Application Result
       |
       v
Admin Controller -----> Admin Mapper -----> Admin Response DTO
Storefront Controller -> Storefront Mapper -> Storefront Response DTO

Admin Module ---------> CategoryCoreModule <--------- Storefront Module
                              |
                              v
                Persistence Infrastructure Module
```

Diễn giải:

- Controller gọi Application.
- Application sử dụng Domain và Application Port.
- Infrastructure Adapter phụ thuộc vào công nghệ cụ thể và triển khai Port.
- Controller gọi Presentation Mapper để chuyển Application Result thành Response DTO; Application không phụ thuộc Presentation.
- `CategoryCoreModule` là Composition Root cho binding Port-to-adapter.
- Admin và Storefront phụ thuộc vào shared Core; không phụ thuộc trực tiếp vào Application service của surface còn lại.
- `CategoryModule` chỉ aggregate hai surface module; mỗi surface vẫn import `CategoryCoreModule` trực tiếp.

Quy tắc bắt buộc:

- Domain không import Application, Controller, DTO, Prisma hoặc NestJS.
- Application không import Prisma Adapter hoặc client cụ thể.
- Application Port không khai báo kiểu dữ liệu phụ thuộc Prisma/HTTP SDK.
- Controller không truy vấn database trực tiếp.
- Infrastructure có thể phụ thuộc framework/thư viện để triển khai adapter.
- Không tạo circular dependency giữa các tầng hoặc module.
- Không dùng `index.ts`/barrel export để che giấu dependency không hợp lệ.

## 7. Quy ước đặt tên

| Thành phần | Quy ước | Ví dụ |
|---|---|---|
| File | `kebab-case` | `admin-category.service.ts` |
| Class | `PascalCase` | `AdminCategoryService` |
| Interface/Type | `PascalCase` | `CategoryRepository` |
| Enum | `PascalCase` | `CategoryImageSlot` |
| Constant | `UPPER_SNAKE_CASE` | `CATEGORY_IMAGE_LIMIT` |
| DTO | Hậu tố `.dto.ts` | `create-category.dto.ts` |
| Service | Hậu tố `.service.ts` | `category.service.ts` |
| Adapter | Tên công nghệ + khả năng | `prisma-category.repository.ts` |
| Test | Hậu tố `.spec.ts` | `category.service.spec.ts` |

Quy tắc bổ sung:

- Tên phải thể hiện nghiệp vụ hoặc vai trò.
- Tránh tên chung chung như `common.ts`, `helper.ts`, `utils.ts`, `data.ts` nếu có thể dùng tên cụ thể hơn.
- Port nên đặt tên theo hợp đồng/khả năng, không gắn công nghệ.
- Adapter được phép thể hiện công nghệ cụ thể trong tên.

## 8. Ánh xạ từ cấu trúc hiện tại

| Vị trí hiện tại | Vị trí đích |
|---|---|
| `category/domain/category-record.ts` | `domain/models/category.model.ts` (đổi tên để tránh nhầm với persistence record) |
| `category/domain/category-tree.ts` | `domain/tree/category-tree.ts` |
| `category/domain/category-locale.ts` | `domain/localization/category-locale.ts` |
| `category/domain/category-image-*` | `domain/image/` |
| `category/domain/category-errors.ts` | `domain/errors/category-errors.ts` |
| `category/repositories/category.repository.ts` | `application/ports/persistence/category.repository.ts` |
| `category/services/admin/` | `admin/application/`, phân nhóm category/image/translation |
| `category/services/shared/` | `application/shared/`, chỉ giữ logic thực sự dùng chung |
| `category/services/storefront/` | `storefront/application/`, phân nhóm theo capability |
| `category/controllers/admin/` | `admin/controllers/` |
| `category/controllers/storefront/` | `storefront/controllers/` |
| `category/dto/admin/` | `admin/dto/` |
| `category/dto/storefront/` | `storefront/dto/` |
| `category/dto/shared/` | Đưa về DTO của surface sở hữu hợp đồng; chỉ chia sẻ nếu cùng ngữ nghĩa API |
| `category/clients/` | `infrastructure/integrations/translation/` |
| `category/infrastructure/persistence/relational/` | Giữ tầng, phân loại `queries/` và `adapters/` |
| `category/mappers/` | `admin/presentation/mappers/` hoặc `storefront/presentation/mappers/` theo API sở hữu |
| `category/services/admin/category-test-setup.ts` | `testing/category-test-setup.ts` |
| Một `category.module.ts` vừa khai báo controllers/providers vừa bind Port | Tách thành `CategoryCoreModule`, `AdminCategoryModule`, `StorefrontCategoryModule`; `CategoryModule` chỉ aggregate hai surface module |

Việc chuyển file phải đi kèm:

- Cập nhật import path.
- Cập nhật module/provider và DI token.
- Đảm bảo Admin và Storefront import trực tiếp `CategoryCoreModule`, provider được export/import rõ ràng và không có phụ thuộc chéo giữa hai surface.
- Cập nhật test setup nếu có.
- Chạy build, type-check, lint và test liên quan.
- Kiểm tra không vô tình thay đổi API hoặc hành vi nghiệp vụ.

Không kết hợp refactor nghiệp vụ lớn vào cùng một thay đổi chỉ nhằm tổ chức lại cấu trúc, trừ khi có yêu cầu riêng.

## 9. Quy trình quyết định vị trí file mới

Trước khi tạo file/folder, trả lời lần lượt:

1. File này giải quyết trách nhiệm gì?
2. Nó thuộc Domain, Application, Presentation, HTTP adapter hay Infrastructure?
3. Nó được phép phụ thuộc vào những tầng/thư viện nào?
4. Có thể đặt vào file hiện có mà vẫn giữ trách nhiệm rõ ràng không?
5. Có cần abstraction mới hay chỉ cần một hàm/class đơn giản?
6. Thành phần này có thực sự được dùng chung không?
7. Test của nó nên đặt cạnh code hay là helper dùng chung?

Nếu chưa trả lời rõ, cần xem lại thiết kế trước khi tạo thêm folder hoặc abstraction.

## 10. Điều kiện chấp nhận

Một thay đổi về cấu trúc Category chỉ được xem là đạt khi:

- [ ] File nằm đúng tầng và đúng folder theo convention.
- [ ] Không có dependency ngược làm Application phụ thuộc Infrastructure.
- [ ] Domain không phụ thuộc framework/database/HTTP.
- [ ] Với mỗi dependency outbound cần Port theo quy tắc kiến trúc, Port được khai báo ở Application và adapter được kết nối đúng qua DI; không yêu cầu Port/adapter cho logic thuần không có dependency outbound.
- [ ] Shared chỉ chứa thành phần thực sự dùng chung trong Category.
- [ ] Admin và Storefront có module riêng khi use case/API độc lập đáng kể; mỗi surface import trực tiếp `CategoryCoreModule`.
- [ ] Không có phụ thuộc trực tiếp giữa Admin và Storefront; Domain, Ports và Infrastructure dùng chung thay vì bị nhân đôi.
- [ ] Port-to-adapter binding thuộc `CategoryCoreModule`; provider visibility được khai báo rõ theo NestJS module imports/exports.
- [ ] Nếu một use case cần atomicity, transaction được biểu đạt bằng persistence operation hoặc Transaction Port theo đúng phạm vi phối hợp; nếu có Transaction Port, context được cô lập giữa các lần gọi và adapter xử lý rõ commit/rollback, callback không tự chạy lại và nested transaction theo đúng hợp đồng.
- [ ] Nếu có Presentation Mapper, controller gọi mapper sau khi nhận Application Result; mapper không chứa nghiệp vụ/truy vấn và không phụ thuộc persistence type. Controller có thể ghép phép chuyển đổi đơn giản trực tiếp khi rõ ràng.
- [ ] Không tạo folder, interface hoặc abstraction không cần thiết.
- [ ] Import path và module provider đã cập nhật.
- [ ] Build, type-check, lint và test liên quan đạt.
- [ ] Hành vi nghiệp vụ hiện tại được giữ nguyên nếu thay đổi chỉ nhằm refactor cấu trúc.

## 11. Nguyên tắc áp dụng sang module khác

Tài liệu này là tiêu chuẩn thử nghiệm cho module Category.

Khi áp dụng sang Product, Product Option, Pricing hoặc module khác:

- Giữ nguyên nguyên tắc phân tầng và chiều phụ thuộc.
- Điều chỉnh folder theo nghiệp vụ thực tế của module.
- Không sao chép máy móc toàn bộ folder của Category.
- Không tạo Domain Model, Port, Adapter, Mapper hoặc Service nếu module không có nhu cầu.
- Chỉ nâng convention thành chuẩn toàn dự án sau khi đã áp dụng, review và xác nhận hiệu quả trên Category.

---

**Nguyên tắc cốt lõi:** Cấu trúc thư mục phải giúp code dễ tìm, dễ hiểu, dễ kiểm thử và dễ thay đổi. Không tối ưu cây thư mục vì hình thức; tối ưu theo trách nhiệm và chiều phụ thuộc.
