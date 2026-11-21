# Category Clean Code & Code Quality Convention

**Phiên bản:** 1.6
**Phạm vi:** Code trong NestJS `category` module
**Trạng thái:** Proposed
**Mục tiêu:** Đảm bảo code dễ đọc, dễ kiểm thử, đúng nghiệp vụ, an toàn khi thay đổi và nhất quán với Category Folder Structure Convention.

---

## 1. Mục tiêu và nguyên tắc chung

1. Viết code để người khác dễ hiểu trước khi tối ưu cho độ ngắn.
2. Ưu tiên giải pháp đơn giản, đúng yêu cầu; tránh over-engineering.
3. Mỗi class/function có một trách nhiệm chính và một lý do chính để thay đổi.
4. Tên phải thể hiện ý nghĩa nghiệp vụ, tránh tên mơ hồ.
5. Không lặp lại quy tắc nghiệp vụ ở nhiều nơi.
6. Không che giấu lỗi hoặc tạo side effect không rõ ràng.
7. Mọi thay đổi nghiệp vụ quan trọng phải có kiểm thử phù hợp.
8. Giữ nguyên hành vi hiện tại khi chỉ refactor cấu trúc, trừ khi ticket yêu cầu thay đổi hành vi.
9. Chất lượng code phải được kiểm tra bằng cả review thủ công và công cụ tự động phù hợp.
10. Không áp dụng máy móc một quy tắc nếu nó làm code khó hiểu hơn; trường hợp ngoại lệ phải có lý do rõ ràng.

### Cách hiểu mức độ quy tắc

- **Bắt buộc (MUST):** phải tuân thủ; ngoại lệ cần được review và ghi rõ lý do.
- **Nên (SHOULD):** lựa chọn mặc định; có thể khác đi khi có lý do kỹ thuật/nghiệp vụ hợp lý.
- **Có điều kiện (CONDITIONAL):** chỉ áp dụng khi tình huống được nêu thực sự tồn tại.
- Trong các quy tắc, “phải/bắt buộc/không được” biểu thị MUST; “nên” biểu thị SHOULD; “có thể” nêu một lựa chọn được phép. Nếu một điều kiện là tiêu chí chặn review hoặc Definition of Done, phải ghi rõ là MUST hoặc thể hiện rõ bằng “phải/không được”.
- Bảng, ví dụ và danh sách tình huống tham khảo không tự biến mọi mục thành yêu cầu bắt buộc; các mục có điều kiện chỉ áp dụng khi điều kiện được nêu xảy ra.

**Nguồn chuẩn về kiến trúc:** `01-category-folder-structure-convention-v1.6.md` là nguồn chuẩn duy nhất cho phân tầng, vị trí file, dependency direction, Port/adapter, DI, mapper và transaction boundary. Khi có khác biệt, ưu tiên tài liệu 01. Tài liệu này chỉ nêu tiêu chí chất lượng code và cách review; không tạo thêm quy tắc kiến trúc song song.

## 2. Quy tắc thiết kế code

### 2.1. Single Responsibility Principle (SRP)

- Service tập trung vào một nhóm use case liên quan.
- Function nên thực hiện một bước nghiệp vụ rõ ràng.
- Tách class/function khi có trách nhiệm độc lập hoặc thay đổi vì lý do khác nhau.
- Không tách máy móc mỗi vài dòng thành một service/helper mới.
- Không tạo service chỉ để bọc một lời gọi khác mà không bổ sung trách nhiệm hoặc ranh giới có ích.

Ví dụ: nghiệp vụ Category CRUD không nên đồng thời đảm nhiệm upload ảnh, gọi API dịch thuật và dựng HTTP response.

### 2.2. KISS — Keep It Simple

- Chọn cách triển khai ít khái niệm nhất nhưng vẫn đáp ứng yêu cầu.
- Không tạo factory, strategy, generic abstraction hoặc wrapper nếu chưa có nhu cầu cụ thể.
- Không tạo interface chỉ để phản chiếu một class mà không tạo ra ranh giới phụ thuộc có ích.
- Ưu tiên code tường minh hơn giải pháp quá tổng quát nhưng khó hiểu.

### 2.3. DRY — Don't Repeat Yourself

- Tránh sao chép cùng một quy tắc nghiệp vụ ở nhiều nơi.
- Chỉ dùng chung khi logic và ý nghĩa thực sự giống nhau.
- Không gom các đoạn code chỉ giống cú pháp nhưng khác ý nghĩa nghiệp vụ vào một hàm generic khó hiểu.
- Không tạo abstraction chung chỉ để loại bỏ vài dòng trùng lặp nhỏ, ổn định và dễ đọc.

### 2.4. SOLID và Dependency Inversion

- **Bắt buộc:** không để dependency đi ngược chiều kiến trúc hoặc làm Domain/Application phụ thuộc implementation Infrastructure.
- **Có điều kiện:** khi Application cần capability từ Infrastructure, dùng Port theo tiêu chí và ngoại lệ đã quy định trong tài liệu 01; không tạo Port chỉ để phản chiếu class.
- **Có điều kiện:** khi có Port, adapter phải được kết nối qua DI theo tài liệu 01.
- **Bắt buộc:** tránh circular dependency.
- **Nên:** chỉ dùng DI tại composition boundary; không tạo thêm tầng trung gian không có trách nhiệm rõ ràng.

Chi tiết phân tầng, vị trí Port/adapter và wiring thuộc tài liệu 01, không lặp lại ở đây.

## 3. Quy tắc đặt tên và cấu trúc file

- Dùng tên thể hiện nghiệp vụ: `removeCategory`, `findVisibleCategoryTree`, `requestCategoryTranslation`.
- Tránh tên không rõ nghĩa như `processData`, `handleInfo`, `doAction`, `temp`, `obj`.
- Boolean nên đọc như câu hỏi/điều kiện: `isActive`, `hasChildren`, `canBeDeleted`.
- Một file nên tập trung vào thành phần chính; không chứa nhiều class không liên quan.
- Dùng `kebab-case` cho tên file và `PascalCase` cho class/type/enum.
- Không tạo `utils.ts` hoặc `common.ts` để chứa các hàm không cùng trách nhiệm.
- Không để code đã ngừng sử dụng, comment cũ hoặc import thừa tồn tại sau refactor.
- Tên phải phản ánh đúng phạm vi: `shared` chỉ dùng khi thực sự dùng chung trong phạm vi đã xác định.
- Không đặt tên gây hiểu nhầm về tầng, ví dụ đặt Prisma record là Domain Entity nếu nó chỉ là dữ liệu persistence.

## 4. Quy tắc TypeScript

- Bật và tuân thủ TypeScript strict mode theo cấu hình dự án.
- Tránh `any`; ưu tiên kiểu cụ thể, `unknown` kèm narrowing hoặc generic có giới hạn phù hợp.
- Tránh type assertion (`as`) nếu có thể dùng type guard hoặc thiết kế kiểu an toàn hơn.
- Chỉ khai báo kiểu return tường minh khi giúp làm rõ hợp đồng public, boundary hoặc trường hợp suy luận kiểu chưa đủ rõ.
- Không dùng DTO làm kiểu dữ liệu nội bộ ở mọi tầng.
- Giữ riêng Domain Model, Application Result, Persistence Record và Response DTO theo quyền sở hữu/boundary trong tài liệu 01.
- Application Result do Application định nghĩa; mapper ở Presentation nhận Application Result và tạo Response DTO; controller gọi mapper sau khi use case trả kết quả.
- Phân biệt rõ `null`, `undefined`, trường không được gửi và trường có giá trị rỗng.
- Không dùng non-null assertion (`!`) để né kiểm tra dữ liệu nếu chưa chứng minh được điều kiện an toàn.
- Tránh ép kiểu hai lần qua `unknown` hoặc kiểu khác để vượt qua kiểm tra của TypeScript.
- Không tắt kiểm tra type/lint trên phạm vi rộng để làm cho build vượt qua.
- Nếu cần `@ts-ignore`, `@ts-expect-error` hoặc eslint-disable, phải giới hạn phạm vi và giải thích lý do.

### 4.1. Phân biệt dữ liệu Update

Đối với API cập nhật, phải xác định rõ ý nghĩa của:

- Field không xuất hiện: giữ nguyên giá trị hiện tại, nếu đó là semantics của API.
- Field có giá trị `null`: xóa/đặt rỗng theo hợp đồng đã định nghĩa.
- Field có giá trị cụ thể: cập nhật giá trị.
- Field có chuỗi rỗng: chỉ chấp nhận nếu nghiệp vụ cho phép.

Không tự suy diễn semantics của `null`, `undefined` hoặc chuỗi rỗng. Phải nhất quán với API contract và persistence.

## 5. Quy tắc Async/Await và Promise

- Không bỏ quên Promise từ thao tác bất đồng bộ.
- Chỉ dùng `async` khi function cần `await` hoặc cần trả về Promise theo hợp đồng rõ ràng.
- Nếu chỉ chuyển tiếp một Promise mà không xử lý thêm, có thể return trực tiếp.
- Dùng `await` khi cần xử lý kết quả, bắt lỗi hoặc đảm bảo thứ tự thực thi.
- Dùng `Promise.all()` khi các thao tác độc lập và có thể chạy song song an toàn.
- Không dùng chạy song song cho các thao tác có phụ thuộc thứ tự hoặc cùng ghi dữ liệu có thể xung đột.
- Không tạo fire-and-forget task mà không có chiến lược theo dõi lỗi, retry và quan sát trạng thái.
- Không bắt lỗi bất đồng bộ rồi bỏ qua.
- Với tác vụ nền, phải xác định rõ cơ chế lưu trạng thái, retry, idempotency và xử lý khi tiến trình dừng giữa chừng theo yêu cầu nghiệp vụ.

## 6. Quy tắc xử lý lỗi

- Dùng lỗi Domain/Application có ý nghĩa nghiệp vụ cho các tình huống như slug conflict, category not found hoặc không thể xóa do quan hệ phụ thuộc.
- Chuyển lỗi kỹ thuật của Prisma/API tại Infrastructure boundary khi phù hợp.
- Controller hoặc exception filter chịu trách nhiệm ánh xạ lỗi sang HTTP response.
- Không để Prisma-specific error hoặc raw provider error rò rỉ vào Domain.
- Không bắt lỗi rồi bỏ qua (`catch` rỗng) hoặc chỉ log mà vẫn giả vờ thành công.
- Chỉ catch khi có thể xử lý, bổ sung ngữ cảnh hoặc chuyển đổi lỗi có chủ đích; nếu không, để lỗi truyền lên.
- Không trả thông tin nội bộ, stack trace hoặc credential cho client.
- Không biến mọi lỗi thành cùng một lỗi chung nếu việc đó làm mất thông tin cần thiết để xử lý hoặc phản hồi đúng.
- Không để message lỗi kỹ thuật trở thành API contract công khai.

## 7. Quy tắc validation và nghiệp vụ

- DTO chịu trách nhiệm kiểm tra hình dạng và định dạng request tại biên API.
- Domain/Application chịu trách nhiệm các invariant và quy tắc nghiệp vụ; không xem DTO validation là thay thế cho business validation.
- Kiểm tra quyền truy cập tại guard/policy hoặc application boundary phù hợp với kiến trúc dự án.
- Không tin dữ liệu do client gửi, kể cả ID, slug, locale hoặc storage key.
- Quy tắc quan trọng phải được thực thi ở server, không dựa vào validation phía giao diện.
- Các thao tác cạnh tranh như tạo slug, cập nhật cây hoặc bật/tắt locale cần dựa vào transaction/constraint/locking phù hợp; không chỉ kiểm tra trước rồi giả định dữ liệu sẽ không đổi.
- Chuẩn hóa dữ liệu đầu vào phải có quy tắc rõ ràng và nhất quán; không tự ý thay đổi dữ liệu theo cách làm thay đổi ý nghĩa nghiệp vụ.
- Không lặp cùng một business validation ở nhiều tầng nếu không có lý do; tuy nhiên invariant quan trọng vẫn phải được bảo vệ tại boundary có thẩm quyền.

## 8. Quy tắc Persistence và tích hợp ngoài

Áp dụng phân tầng và boundary theo `01-category-folder-structure-convention-v1.6.md`. Các tiêu chí chất lượng khi làm việc với persistence/integration:

- Không trả Prisma Model hoặc Persistence Record trực tiếp từ Controller/API.
- Query chỉ lấy các field cần thiết cho use case; tránh include/select quá rộng không cần thiết.
- Mapping và chuyển đổi lỗi kỹ thuật phải được thực hiện tại boundary phù hợp; không làm lộ chi tiết persistence/provider vào Domain hoặc API contract.
- Với client bên ngoài, cân nhắc timeout, retry có giới hạn, idempotency và cách xử lý provider unavailable theo yêu cầu nghiệp vụ.
- Không retry vô hạn hoặc retry thao tác không an toàn khi chưa có idempotency phù hợp.
- Không tạo Port, adapter hoặc wrapper trùng lặp với quy tắc kiến trúc ở tài liệu 01.
- Kiểu dữ liệu của Persistence Port phải tuân thủ boundary Domain/Application; không để Persistence Record hoặc kiểu phụ thuộc ORM/database đi qua Port contract.
- Nếu dùng projection/read model cho truy vấn cụ thể, kiểu đó phải do Application sở hữu; không import trực tiếp kiểu từ Persistence layer.

## 9. Quy tắc Transaction và Concurrency

### 9.1. Transaction Boundary

Cách biểu đạt transaction ở Application, hợp đồng commit/rollback, propagation/isolation của transaction context và chính sách nested transaction được quy định tại tài liệu 01. Tại góc độ chất lượng, phải bảo đảm:

- Application/use case xác định đơn vị nghiệp vụ cần được bảo đảm nhất quán.
- Infrastructure chịu trách nhiệm thực thi transaction bằng công nghệ cụ thể.
- Không để Controller tự quản lý transaction nghiệp vụ.
- Transaction phải bao trùm đúng các thay đổi dữ liệu cần thành công/thất bại cùng nhau.
- Không mở transaction quá rộng hoặc kéo dài không cần thiết.
- Không mặc nhiên giữ database transaction trong lúc gọi API bên ngoài hoặc thực hiện tác vụ chậm.
- Nếu nghiệp vụ cần phối hợp database và dịch vụ ngoài, phải xác định chiến lược nhất quán phù hợp thay vì giả định một transaction database có thể bao phủ cả hai hệ thống.

### 9.2. Concurrency

- Xác định các thao tác có nguy cơ chạy đồng thời: tạo slug, di chuyển node trong cây, cập nhật trạng thái locale, xử lý translation job.
- Dùng unique constraint, transaction isolation, locking hoặc cơ chế phù hợp theo invariant cần bảo vệ.
- Không coi bước kiểm tra trước khi ghi là biện pháp bảo vệ duy nhất.
- Phân biệt lỗi xung đột nghiệp vụ có thể dự đoán với lỗi hạ tầng.
- Với tác vụ có thể được thực hiện lại, cân nhắc idempotency để tránh ghi nhận hoặc thực hiện tác động trùng lặp.
- Test concurrency cho các luồng đã xác định có rủi ro; không thêm test race condition hình thức nếu không có kịch bản thực tế.

## 10. Quy tắc Logging và Observability

- Logging phải phục vụ chẩn đoán, theo dõi hoặc audit có mục đích.
- Không log tràn lan ở mọi tầng.
- Không log token, secret, credential hoặc dữ liệu nhạy cảm.
- Không log toàn bộ request/payload nếu không cần thiết.
- Ưu tiên log có cấu trúc và context hữu ích như operation, categoryId, correlationId hoặc jobId khi phù hợp.
- Log lỗi tại boundary có đủ ngữ cảnh và tránh ghi cùng một lỗi nhiều lần ở nhiều tầng mà không có lý do.
- Không dùng log thay thế cho xử lý lỗi hoặc cơ chế theo dõi trạng thái tác vụ nền.
- Không để log chứa nội dung có thể làm lộ dữ liệu nội bộ của Admin/Storefront.

## 11. Quy tắc API Contract và Backward Compatibility

- Không tự ý đổi tên field, kiểu dữ liệu hoặc semantics của API response.
- Không xóa field đang được sử dụng nếu chưa đánh giá ảnh hưởng và có kế hoạch chuyển đổi phù hợp.
- Không đưa field nội bộ hoặc dữ liệu nhạy cảm vào Storefront response.
- DTO phải phản ánh đúng hợp đồng của endpoint, không dùng một DTO chung chỉ vì các field tình cờ giống nhau.
- Khi thay đổi request/response contract, cập nhật tài liệu API và kiểm tra các consumer liên quan.
- Với thay đổi có khả năng breaking change, phải có kế hoạch versioning hoặc migration phù hợp với chiến lược API của dự án.
- Không coi việc build backend thành công là bằng chứng rằng frontend/client không bị ảnh hưởng.

## 12. Quy tắc bảo mật

- Không trả dữ liệu nội bộ của Category cho Storefront nếu không thuộc hợp đồng công khai.
- Kiểm tra authorization cho mọi thao tác quản trị và thay đổi dữ liệu.
- Validate và normalize dữ liệu đầu vào ở server.
- Không tin storage key, URL ảnh hoặc locale do client tự khai báo nếu chưa kiểm tra quyền sở hữu/phạm vi hợp lệ.
- Không ghi log credential, access token hoặc dữ liệu nhạy cảm.
- Tránh lộ chi tiết database, đường dẫn nội bộ hoặc provider error trong response.
- Không dựa vào việc ẩn nút trên frontend để bảo vệ endpoint.
- Kiểm tra quyền trên tài nguyên cụ thể khi nghiệp vụ yêu cầu, không chỉ kiểm tra người dùng đã đăng nhập.

## 13. Quy tắc kiểm thử

### 13.1. Unit Test

Tập trung kiểm tra hành vi của một đơn vị với dependency được mock/fake khi cần.

Các trường hợp quan trọng của Category nên có test phù hợp:

- Tạo Category hợp lệ và không hợp lệ.
- Slug bị trùng.
- Parent không tồn tại hoặc quan hệ cây không hợp lệ.
- Tạo/cập nhật gây chu trình trong cây.
- Xóa Category có hoặc không có quan hệ phụ thuộc.
- Category không hiển thị do trạng thái của chính nó hoặc tổ tiên.
- Locale không hỗ trợ.
- Dữ liệu translation thành công, thất bại, đang chờ hoặc hết lease.
- Cập nhật cạnh tranh/race condition ở những luồng đã xác định có rủi ro.

Không phải mọi test đều phải nằm trong một test suite hoặc dùng cùng một loại mock. Chọn cách test phù hợp với boundary đang kiểm tra.

### 13.2. Integration Test

Kiểm tra tương tác thật giữa các thành phần cần xác minh, ví dụ:

- Application Service với Prisma adapter/database.
- Transaction và constraint quan trọng.
- Với Transaction Port: commit/rollback, commit failure phải reject, rollback failure không làm mất lỗi gốc, callback không tự chạy lại, từ chối nested transaction theo hợp đồng, cleanup context sau khi kết thúc và cô lập context giữa các transaction chạy đồng thời.
- Mapping dữ liệu persistence.
- Luồng HTTP quan trọng qua controller, validation, guard và response mapping.
- Tích hợp với dịch vụ ngoài bằng môi trường test hoặc test double phù hợp.

### 13.3. Quy tắc chung

- Test hành vi quan sát được, không khóa chặt vào chi tiết implementation không cần thiết.
- Tên test mô tả điều kiện và kết quả mong đợi.
- Có test cho success path, validation/business failure và dependency failure quan trọng.
- Không dùng mock quá mức đến mức test không còn kiểm tra logic thực tế.
- Test phải độc lập, có dữ liệu chuẩn bị và dọn dẹp rõ ràng.
- Bug đã sửa nên có regression test phù hợp.
- Không làm test phụ thuộc vào thứ tự chạy.
- Không dùng sleep/delay tùy tiện để chờ tác vụ bất đồng bộ nếu có cách đồng bộ hoặc chờ điều kiện đáng tin cậy hơn.
- Khi test lỗi, cần kiểm tra đúng loại lỗi/hành vi cần thiết; tránh chỉ kiểm tra rằng “có throw” chung chung.

## 14. Quy tắc độ phức tạp và khả năng bảo trì

Không áp dụng số dòng tối đa cứng cho mọi file hoặc function. Review sâu khi thấy:

| Dấu hiệu | Hướng xử lý |
|---|---|
| Service có nhiều trách nhiệm không liên quan | Xem xét tách theo trách nhiệm nghiệp vụ |
| Function có nhiều nhánh lồng nhau | Xem xét early return hoặc tách bước có ý nghĩa |
| Nhiều tham số | Xem xét object parameter hoặc kiểu dữ liệu mô tả rõ ý nghĩa |
| Nhiều boolean parameter làm thay đổi hành vi | Xem xét tách function hoặc dùng kiểu dữ liệu tường minh |
| Logic nghiệp vụ bị copy ở nhiều nơi | Xem xét dùng chung nếu cùng ý nghĩa |
| File có nhiều class/helper không liên quan | Xem xét tách file |
| Dependency được inject nhưng không sử dụng | Loại bỏ dependency |
| Function quá dài | Review trách nhiệm và khả năng hiểu, không tự động tách theo số dòng |

Ưu tiên tách theo trách nhiệm nghiệp vụ, không tách chỉ để đạt một con số dòng code nhất định.

## 15. Automated Quality Gate

Các quy tắc quan trọng nên được kiểm tra tự động khi dự án có công cụ hỗ trợ.

| Hạng mục | Cách kiểm tra/công cụ tham khảo |
|---|---|
| Formatting | Prettier hoặc formatter hiện có |
| Lint | ESLint |
| Type safety | TypeScript compiler, strict mode |
| Unit test | Jest hoặc test runner hiện có |
| Integration test | Test runner + database/test environment |
| Dependency boundary | ESLint boundaries, dependency-cruiser hoặc công cụ tương đương |
| Coverage | Coverage report của test runner |
| Build | Build script của dự án |
| CI | Pipeline CI hiện có |

Quy tắc:

1. Ưu tiên dùng script và công cụ đã có trong repository.
2. Không cài thêm công cụ chỉ để làm đẹp danh sách nếu không có lợi ích rõ ràng.
3. Các kiểm tra bắt buộc phải được ghi rõ trong package script/CI của dự án.
4. Không tuyên bố một hạng mục đã đạt nếu chưa chạy hoặc chưa có bằng chứng.
5. Coverage là tín hiệu tham khảo; không dùng một tỷ lệ coverage duy nhất để thay thế đánh giá chất lượng test.
6. Dependency rule nên được tự động hóa ở mức khả thi để ngăn import sai tầng.
7. Không tắt rule toàn dự án chỉ để xử lý một trường hợp riêng; nếu cần ngoại lệ, giới hạn phạm vi và ghi rõ lý do.

## 16. Tiêu chí review Pull Request

Một thay đổi trong Category được xem xét hoàn tất khi các câu hỏi phù hợp dưới đây đều được trả lời thỏa đáng. Checklist chỉ áp dụng các nhóm liên quan đến phạm vi thay đổi; các điều kiện MUST thuộc phạm vi PR phải được đáp ứng hoặc có ngoại lệ được review và ghi rõ lý do.

### Architecture

Đối chiếu chi tiết với `01-category-folder-structure-convention-v1.6.md`; checklist ở đây chỉ nhắc các điểm cần review, không thay thế nguồn chuẩn.

- [ ] File nằm đúng tầng và đúng folder theo tài liệu 01.
- [ ] Không có dependency ngược; Domain/Application không phụ thuộc implementation Infrastructure.
- [ ] **Nếu use case cần dependency outbound:** Port/adapter được thiết kế và kết nối DI đúng theo tài liệu 01; không yêu cầu Port/adapter cho logic thuần không có dependency outbound.
- [ ] **Nếu use case cần atomicity:** transaction được biểu đạt và thực thi đúng boundary theo tài liệu 01; nếu có Transaction Port, context được propagate và isolate đúng theo async execution chain, commit/rollback đúng hợp đồng, không tự retry callback và nested transaction theo chính sách đã chốt.
- [ ] Persistence Port không làm lộ Prisma Model, Persistence Record hoặc kiểu phụ thuộc ORM/database; projection/read model (nếu có) thuộc Application.
- [ ] Không tạo abstraction/folder không cần thiết.

### Clean Code

- [ ] Tên class, method, biến thể hiện đúng ý nghĩa.
- [ ] Mỗi thành phần có trách nhiệm rõ ràng.
- [ ] Không lặp logic nghiệp vụ có thể dùng chung hợp lý.
- [ ] Không có function/class phức tạp không cần thiết.
- [ ] Không còn code chết, import thừa hoặc debug statement.
- [ ] Async/Promise được xử lý đúng; không có tác vụ nền bị bỏ quên.

### Correctness & Security

- [ ] Có validation ở đúng ranh giới.
- [ ] Các invariant nghiệp vụ được bảo vệ ở server.
- [ ] Xử lý lỗi rõ ràng, không nuốt lỗi.
- [ ] Không lộ thông tin nội bộ hoặc dữ liệu nhạy cảm.
- [ ] Authorization được kiểm tra cho thao tác cần bảo vệ.
- [ ] Transaction/concurrency được cân nhắc cho luồng ghi liên quan.
- [ ] API contract và backward compatibility đã được đánh giá.

### Persistence & Integration

- [ ] Không để Prisma/client cụ thể hoặc Persistence Record rò rỉ qua Application/API boundary.
- [ ] Query chỉ lấy dữ liệu cần thiết.
- [ ] Lỗi kỹ thuật được xử lý tại boundary phù hợp.
- [ ] Timeout/retry/idempotency được cân nhắc cho tích hợp ngoài khi cần.

### Testing

- [ ] Unit test phù hợp đã được thêm/cập nhật.
- [ ] Integration test được cập nhật khi thay đổi ranh giới persistence/API.
- [ ] Regression test có cho bug đã sửa.
- [ ] Test độc lập và không phụ thuộc thứ tự chạy.
- [ ] Các test liên quan đều chạy thành công.

### Delivery

- [ ] Build, lint, type-check và test theo script của dự án đều đạt.
- [ ] Import path và module provider đã cập nhật.
- [ ] Không thay đổi hành vi ngoài phạm vi ticket nếu không được yêu cầu.
- [ ] Tài liệu hoặc API contract được cập nhật khi cần.
- [ ] PR nêu rõ thay đổi, rủi ro và cách kiểm chứng phù hợp.

## 17. Definition of Done cho Category

Một tính năng Category chỉ được xem là hoàn tất khi đáp ứng các điều kiện sau:

1. Đúng nghiệp vụ và đáp ứng acceptance criteria.
2. Code nằm đúng tầng, đúng trách nhiệm.
3. Không phá vỡ quy tắc chiều phụ thuộc.
4. Có xử lý lỗi, validation và authorization phù hợp.
5. Transaction/concurrency được xử lý phù hợp với rủi ro của use case.
6. Có test cho luồng thành công và các trường hợp lỗi quan trọng.
7. Build/type-check/lint/test liên quan đạt.
8. Không có regression đã biết ở Admin, Storefront, localization, image hoặc translation liên quan.
9. API contract và tài liệu liên quan được cập nhật khi cần.
10. PR được review theo checklist phù hợp.

## 18. Ghi chú áp dụng

Tài liệu này là tiêu chuẩn chất lượng code cho module Category. Tài liệu 01 là nguồn chuẩn về cấu trúc và kiến trúc; không duy trì hai bộ quy tắc kiến trúc độc lập.

Khi áp dụng sang Product, Product Option hoặc Pricing:

- Giữ nguyên nguyên tắc nền tảng phù hợp.
- Điều chỉnh business rule, security rule và test cases theo nghiệp vụ từng module.
- Không sao chép máy móc folder, abstraction hoặc test case của Category.
- Ưu tiên các quy tắc có thể kiểm chứng bằng code review hoặc automation.
- Chỉ nâng thành convention toàn dự án sau khi đã áp dụng và đánh giá hiệu quả.

---

**Nguyên tắc cốt lõi:** Clean Code không đồng nghĩa với nhiều class, nhiều interface hoặc nhiều folder. Code tốt phải dễ hiểu, đúng nghiệp vụ, có boundary rõ ràng, dễ kiểm thử và an toàn khi thay đổi.
