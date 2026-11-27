# Convention: chất lượng code (toàn `src`)

> 📖 Xem [README.md](README.md) để biết vị trí file này trong bộ convention. Tài liệu này chỉ nêu **tiêu chí chất lượng code và cách review**. Kiến trúc, tầng, Port, lỗi, transaction và ranh giới module nằm ở [module-architecture-conventions.md](module-architecture-conventions.md); không tạo quy tắc kiến trúc song song ở đây. Phần trùng với [api-rules.md](api-rules.md), [error-logging-conventions.md](error-logging-conventions.md) và [coding-style-conventions.md](coding-style-conventions.md) được dẫn chiếu, không lặp lại.

## 1. Nguyên tắc chung

1. Viết code để người khác dễ hiểu trước khi tối ưu cho độ ngắn.
2. Ưu tiên giải pháp đơn giản, đúng yêu cầu; tránh over-engineering.
3. Mỗi class/function có một trách nhiệm chính và một lý do chính để thay đổi.
4. Tên thể hiện ý nghĩa nghiệp vụ; không lặp quy tắc nghiệp vụ ở nhiều nơi.
5. Không che giấu lỗi hoặc tạo side effect không rõ ràng.
6. Thay đổi nghiệp vụ quan trọng phải có kiểm thử phù hợp.
7. Chỉ refactor cấu trúc thì giữ nguyên hành vi, trừ khi ticket yêu cầu khác.
8. Kiểm tra chất lượng bằng cả review thủ công và công cụ tự động.
9. Không áp dụng máy móc một quy tắc nếu nó làm code khó hiểu hơn; ngoại lệ phải có lý do rõ ràng.

**Mức độ quy tắc.** "Phải/bắt buộc/không được" là MUST (ngoại lệ cần review và ghi lý do). "Nên" là SHOULD (mặc định, có thể khác khi có lý do). "Có điều kiện" chỉ áp dụng khi tình huống nêu ra thực sự tồn tại. Bảng và ví dụ không tự biến mọi mục thành bắt buộc.

## 2. Nguyên tắc thiết kế

- **SRP:** service tập trung vào một nhóm use case liên quan; không tách máy móc mỗi vài dòng, không tạo service chỉ để bọc một lời gọi. Ví dụ: nghiệp vụ CRUD không đồng thời upload ảnh, gọi API dịch và dựng HTTP response.
- **KISS:** chọn cách ít khái niệm nhất mà vẫn đúng yêu cầu; không tạo factory, strategy, generic abstraction hay interface chỉ phản chiếu một class khi chưa có nhu cầu cụ thể.
- **DRY:** chỉ dùng chung khi logic và ý nghĩa thật sự giống nhau; không gom đoạn code chỉ giống cú pháp vào hàm generic khó hiểu.
- **Dependency Inversion:** phải tránh dependency đi ngược chiều kiến trúc và circular dependency; chi tiết Port/DI ở [module-architecture-conventions.md §4](module-architecture-conventions.md#4-port-và-di). Chỉ dùng DI tại composition boundary.

## 3. Đặt tên (phần nghiệp vụ)

Quy ước tên file/hậu tố ở [coding-style-conventions.md §1](coding-style-conventions.md#1-đặt-tên-file).

- Tên thể hiện nghiệp vụ: `removeCategory`, `findVisibleCategoryTree`; tránh `processData`, `handleInfo`, `doAction`, `temp`, `obj`. Boolean đọc như câu hỏi: `isActive`, `hasChildren`, `canBeDeleted`.
- Không tạo `utils.ts`/`common.ts` chứa hàm không cùng trách nhiệm. `shared` chỉ dùng khi thật sự dùng chung trong phạm vi đã xác định.
- Không đặt tên gây hiểu nhầm về tầng (ví dụ gọi Persistence Record là Domain Model).
- Không để code chết, comment cũ hoặc import thừa sau refactor.

## 4. TypeScript

- Tuân thủ strict mode; tránh `any` (lint `no-explicit-any`, xem coding-style §5), ưu tiên kiểu cụ thể, `unknown` kèm narrowing hoặc generic có giới hạn.
- Tránh type assertion `as` khi có type guard hoặc thiết kế kiểu an toàn hơn; không ép kiểu hai lần qua `unknown`; không dùng `!` để né kiểm tra khi chưa chứng minh an toàn.
- Chỉ khai báo kiểu return tường minh khi làm rõ hợp đồng public/boundary.
- Giữ riêng Domain Model, Application Result, Persistence Record và DTO ([module-architecture-conventions.md §3](module-architecture-conventions.md#bốn-dạng-dữ-liệu)); không dùng DTO làm kiểu nội bộ ở mọi tầng.
- Phân biệt `null`, `undefined`, trường không gửi và chuỗi rỗng.
- Không tắt type/lint trên phạm vi rộng để build qua; `@ts-expect-error`/`eslint-disable` phải giới hạn phạm vi và ghi lý do.

### 4.1. Dữ liệu Update

API cập nhật phải xác định rõ: field không xuất hiện = giữ nguyên; field `null` = xoá/đặt rỗng theo hợp đồng; field có giá trị = cập nhật; chuỗi rỗng chỉ chấp nhận khi nghiệp vụ cho phép. Không tự suy diễn; nhất quán với API contract và persistence.

## 5. Async/await và Promise

- Không bỏ quên Promise; chỉ dùng `async` khi cần `await` hoặc hợp đồng trả Promise. Chỉ chuyển tiếp một Promise thì có thể return trực tiếp.
- Dùng `Promise.all()` cho thao tác độc lập; không chạy song song các thao tác có thứ tự phụ thuộc hoặc cùng ghi dữ liệu có thể xung đột.
- Không fire-and-forget khi chưa có chiến lược theo dõi lỗi, retry và quan sát trạng thái; không bắt lỗi bất đồng bộ rồi bỏ qua.
- Tác vụ nền phải xác định cơ chế lưu trạng thái, retry, idempotency và xử lý khi tiến trình dừng giữa chừng (outbox: [07-async-events-jobs.md](../architecture/07-async-events-jobs.md)).

## 6. Lỗi, validation và nghiệp vụ

Chiến lược lỗi: [module-architecture-conventions.md §5](module-architecture-conventions.md#5-xử-lý-lỗi) và [error-logging-conventions.md](error-logging-conventions.md). Thêm các tiêu chí:

- Không `catch` rỗng, không chỉ log rồi giả vờ thành công; chỉ catch khi xử lý, bổ sung ngữ cảnh hoặc chuyển đổi lỗi có chủ đích.
- Không để lỗi Prisma/provider thô rò rỉ vào Domain; không trả stack trace, đường dẫn nội bộ hay credential cho client; message lỗi kỹ thuật không phải API contract công khai.
- DTO kiểm tra hình dạng và định dạng request tại biên API; Domain/Application giữ invariant và quy tắc nghiệp vụ; DTO validation không thay business validation. Không lặp cùng một business validation ở nhiều tầng khi không có lý do, nhưng invariant quan trọng vẫn phải được bảo vệ tại boundary có thẩm quyền.
- Không tin dữ liệu client gửi (ID, slug, locale, storage key); quy tắc quan trọng thực thi ở server.
- Chuẩn hoá đầu vào theo quy tắc rõ ràng, không đổi ý nghĩa nghiệp vụ.

## 7. Persistence và tích hợp ngoài

Biên Port/adapter và kiểu dữ liệu qua Port: [module-architecture-conventions.md §3–§4](module-architecture-conventions.md#3-trách-nhiệm-từng-tầng).

- Không trả Prisma Model hoặc Persistence Record từ controller; query chỉ lấy field cần cho use case.
- Với client bên ngoài, cân nhắc timeout, retry có giới hạn, idempotency và cách xử lý provider unavailable; không retry vô hạn hoặc retry thao tác không an toàn khi chưa có idempotency.
- Projection/read model cho một truy vấn cụ thể do Application sở hữu; không import kiểu từ `infrastructure/`.

## 8. Transaction và concurrency

Hợp đồng transaction: [module-architecture-conventions.md §6](module-architecture-conventions.md#6-transaction). Về chất lượng:

- Service xác định đơn vị nghiệp vụ cần atomic; transaction bao đúng các thay đổi phải thành công/thất bại cùng nhau, không rộng hoặc kéo dài không cần thiết.
- Phối hợp DB và dịch vụ ngoài phải có chiến lược nhất quán (outbox/trạng thái trung gian), không giả định một transaction DB bao phủ cả hai.
- Xác định các thao tác có nguy cơ chạy đồng thời (tạo slug, di chuyển node trong cây, đổi trạng thái locale, translation job...). Dùng unique constraint, locking hoặc atomic update theo invariant cần bảo vệ; kiểm tra trước khi ghi **không** là biện pháp duy nhất.
- Phân biệt xung đột nghiệp vụ dự đoán được với lỗi hạ tầng; thao tác có thể thực hiện lại cần cân nhắc idempotency.
- Chỉ viết test concurrency cho luồng có rủi ro thật, không thêm test race hình thức.

## 9. Logging và bảo mật

Log level, request-id, không log secret: [error-logging-conventions.md](error-logging-conventions.md). Thêm: log phục vụ chẩn đoán có mục đích, không tràn lan ở mọi tầng, không log toàn bộ payload khi không cần, không ghi một lỗi nhiều lần ở nhiều tầng, không dùng log thay cơ chế theo dõi trạng thái tác vụ nền.

Bảo mật:

- Không trả dữ liệu nội bộ cho Storefront nếu không thuộc hợp đồng công khai.
- Kiểm tra authorization cho mọi thao tác quản trị và thay đổi dữ liệu ([api-rules.md R5](api-rules.md#r5-authorization-checkpoint)); kiểm tra quyền trên tài nguyên cụ thể khi nghiệp vụ yêu cầu, không chỉ kiểm tra đã đăng nhập.
- Không dựa vào việc ẩn nút ở frontend để bảo vệ endpoint; không lộ chi tiết DB, đường dẫn nội bộ hay provider error trong response.

## 10. API contract và tương thích ngược

- Không tự ý đổi tên field, kiểu hoặc semantics của response; không xoá field đang dùng khi chưa đánh giá ảnh hưởng và có kế hoạch chuyển đổi.
- DTO phản ánh đúng hợp đồng của endpoint; không dùng một DTO chung chỉ vì field tình cờ giống nhau.
- Thay đổi request/response phải cập nhật tài liệu API và kiểm tra consumer; thay đổi có khả năng breaking phải có kế hoạch versioning hoặc migration phù hợp với chiến lược API ([03-api.md](../architecture/03-api.md)). Build backend thành công không phải bằng chứng client không bị ảnh hưởng.

## 11. Kiểm thử

Mức test cần có theo loại API: [api-rules.md R10](api-rules.md#r10-testing). Nguyên tắc chung:

- Unit test kiểm tra hành vi của một đơn vị với dependency mock/fake ở boundary (Port); integration test kiểm tra tương tác thật cần xác minh (service với adapter/DB, transaction và constraint quan trọng, luồng HTTP qua guard/validation/mapping, và hành vi của `TransactionRunner`: commit/rollback, lồng nhau nhập vào giao dịch ngoài).
- Test hành vi quan sát được, không khoá chặt chi tiết implementation; tên test mô tả điều kiện và kết quả mong đợi.
- Có test cho success path, business failure và dependency failure quan trọng; khi test lỗi, kiểm tra đúng loại lỗi, không chỉ "có throw".
- Test độc lập, không phụ thuộc thứ tự chạy, dữ liệu chuẩn bị và dọn dẹp rõ ràng; không dùng sleep tuỳ tiện để chờ tác vụ bất đồng bộ; không mock quá mức đến mức không còn kiểm tra logic thật.
- Bug đã sửa nên có regression test phù hợp.

## 12. Độ phức tạp và khả năng bảo trì

Giới hạn kích thước file (150/200 dòng, miễn trừ): [module-architecture-conventions.md §8](module-architecture-conventions.md#8-giới-hạn-kích-thước-file). Giới hạn dòng là điều kiện cần, không đủ; review sâu khi thấy:

| Dấu hiệu                                     | Hướng xử lý                                                 |
| -------------------------------------------- | ----------------------------------------------------------- |
| Service có nhiều trách nhiệm không liên quan | Tách theo trách nhiệm nghiệp vụ                             |
| Function có nhiều nhánh lồng nhau            | Early return hoặc tách bước có ý nghĩa                      |
| Nhiều tham số                                | Object parameter hoặc kiểu mô tả rõ ý nghĩa                 |
| Nhiều boolean parameter đổi hành vi          | Tách function hoặc dùng kiểu tường minh                     |
| Logic nghiệp vụ copy ở nhiều nơi             | Dùng chung nếu cùng ý nghĩa                                 |
| File có nhiều class/helper không liên quan   | Tách file                                                   |
| Dependency được inject nhưng không dùng      | Loại bỏ                                                     |
| Function dài dù file chưa vượt 200 dòng      | Review trách nhiệm và khả năng hiểu, không tách chỉ theo số |

## 13. Automated quality gate

Ưu tiên script và công cụ đã có trong repo: format (`npm run format:check`), lint (oxlint), type-check (`npm run typecheck`), unit/e2e (Vitest), build, `agents:check`, CI. Dependency boundary tự động hoá bằng luật lint ở [module-architecture-conventions.md §9](module-architecture-conventions.md#9-bộ-luật-lint) (script sinh và `max-lines` có từ task 40; trước đó review thủ công).

1. Không cài thêm công cụ chỉ để làm đẹp danh sách khi không có lợi ích rõ ràng.
2. Kiểm tra bắt buộc phải nằm trong package script/CI.
3. Không tuyên bố một hạng mục đạt khi chưa chạy hoặc chưa có bằng chứng.
4. Coverage là tín hiệu tham khảo, không thay thế đánh giá chất lượng test.
5. Không tắt rule toàn dự án cho một trường hợp riêng; ngoại lệ giới hạn phạm vi và ghi lý do.

## 14. Checklist review Pull Request

Chỉ áp dụng nhóm liên quan đến phạm vi thay đổi.

**Architecture** (với module mới hoặc đã chuyển đổi, xem Migration status; `TransactionRunner` và `src/common/errors/` có từ task 39, `max-lines` có từ task 40)

- [ ] File nằm đúng tầng và thư mục theo [module-architecture-conventions.md](module-architecture-conventions.md); không có dependency ngược.
- [ ] Mọi truy cập DB đi qua Persistence Port; không Prisma/`nestjs-cls` ngoài `infrastructure/`.
- [ ] Use case cần atomicity dùng `TransactionRunner.run()`; không `tx` qua port, không gọi ra ngoài trong giao dịch.
- [ ] Lỗi ném từ `src/common/errors/` ở `domain/`/`application/`; module khác chỉ được gọi qua class công khai.
- [ ] Không tạo abstraction/thư mục không cần thiết; file không vượt 200 dòng.

**Clean code**

- [ ] Tên đúng ý nghĩa, mỗi thành phần một trách nhiệm, không lặp logic nghiệp vụ, không code chết/import thừa/debug statement.
- [ ] Async/Promise xử lý đúng; không có tác vụ nền bị bỏ quên.

**Correctness và security**

- [ ] Validation đúng ranh giới; invariant được bảo vệ ở server; lỗi không bị nuốt; không lộ thông tin nội bộ.
- [ ] Authorization được kiểm tra; transaction/concurrency được cân nhắc cho luồng ghi; API contract và tương thích ngược đã đánh giá.

**Persistence và tích hợp**

- [ ] Prisma/Persistence Record không rò rỉ qua Port, Application hay API; query chỉ lấy dữ liệu cần.
- [ ] Timeout/retry/idempotency được cân nhắc cho tích hợp ngoài.

**Testing và delivery**

- [ ] Unit/integration test phù hợp đã thêm hoặc cập nhật; regression test cho bug đã sửa; test độc lập.
- [ ] Build, lint, typecheck, test, `format:check` đạt; Swagger diff rỗng khi chỉ refactor.
- [ ] Import path và module provider cập nhật; không đổi hành vi ngoài phạm vi ticket.
- [ ] Tài liệu cây thư mục/đường dẫn và API contract cập nhật trong cùng PR; mục Migration status của rule agent cập nhật khi chuyển module.
- [ ] PR nêu rõ thay đổi, rủi ro và cách kiểm chứng.

## 15. Definition of Done cho một tính năng

1. Đúng nghiệp vụ và đáp ứng acceptance criteria.
2. Code nằm đúng tầng, đúng trách nhiệm; không phá chiều phụ thuộc.
3. Có xử lý lỗi, validation và authorization phù hợp.
4. Transaction/concurrency xử lý phù hợp với rủi ro của use case.
5. Có test cho luồng thành công và các trường hợp lỗi quan trọng.
6. Build/typecheck/lint/test liên quan đạt.
7. Không có regression đã biết ở Back-office, Storefront hoặc module phụ thuộc.
8. API contract và tài liệu liên quan được cập nhật; với API mới còn phải đạt Definition of Done và checklist ở [api-rules.md](api-rules.md#definition-of-done).
9. PR được review theo checklist trên.

---

**Nguyên tắc cốt lõi:** Clean code không đồng nghĩa với nhiều class, interface hay thư mục. Code tốt dễ hiểu, đúng nghiệp vụ, có boundary rõ ràng, dễ kiểm thử và an toàn khi thay đổi.
