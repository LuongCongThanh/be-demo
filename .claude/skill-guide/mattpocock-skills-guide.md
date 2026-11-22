# Matt Pocock Skills — guide

> **Phiên bản:** plugin 1.3.2. Môi trường này có 39 skill từ `mattpocock/skills`: 27 skill trong plugin, 4 skill misc cài riêng và 8 skill in-progress. Xem [repo và changelog upstream](https://github.com/mattpocock/skills).

## Chọn workflow

- **Yêu cầu còn mơ hồ:** `grill-with-docs` → `to-spec` → `to-tickets`.
- **Ticket nhỏ hoặc đã rõ:** `implement` dùng TDD, kiểm tra và review trong luồng làm việc.
- **Spec gồm nhiều ticket:** `implement-spec` điều phối task graph và các implementer trên worktree, rồi tích hợp và review.
- **Bug khó:** `diagnosing-bugs` tạo vòng tái hiện ngắn để tìm nguyên nhân; `triage` dành cho issue/PR bên ngoài chưa sẵn sàng làm.
- **Việc lớn, chưa biết hướng:** `wayfinder` chia bài toán thành các quyết định có thể giải lần lượt.
- **Hoàn tất thay đổi:** `code-review` kiểm tra diff, `pr` cấu trúc body, `retro` đề xuất cải thiện môi trường làm việc.
- **Chưa biết chọn skill nào:** `ask-matt` định tuyến tới skill/flow phù hợp.

Với Claude Code, skill của plugin có thể gọi theo dạng `/mattpocock-skills:<skill>`. Skill `user-invoked` cần được gọi trực tiếp; skill `model-invocable` có thể được agent tự chọn khi phù hợp. Riêng `software-factory`, upstream đánh dấu user-invoked, nhưng bản local đã bỏ `disable-model-invocation` để cho phép tự kích hoạt; cập nhật upstream có thể ghi đè thay đổi này.

## Dùng trong `be-demo`

| Tình huống                             | Skill và kết quả mong đợi                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Chốt yêu cầu cho feature ecommerce     | `grill-with-docs` làm rõ lựa chọn, thuật ngữ và quyết định; sau đó ghi glossary/ADR khi cần.    |
| Chia feature lớn thành công việc       | `to-spec` tạo spec; `to-tickets` tạo các lát cắt dọc và ghi rõ blocker.                         |
| Implement ticket đã rõ                 | `implement` làm theo TDD tại public seam, chạy kiểm tra, review và hoàn tất ticket.             |
| Thực hiện cả spec nhiều ticket         | `implement-spec` điều phối task graph, worktree và tích hợp trên một nhánh.                     |
| Bug khó tái hiện                       | `diagnosing-bugs` xác lập reproduction loop, thu hẹp lỗi và kiểm chứng fix.                     |
| Chuẩn bị PR                            | `code-review` đánh giá Standards/Spec; `pr` viết Summary, Evidence và Merge Danger.             |
| Làm rõ thuật ngữ hoặc ranh giới module | `domain-modeling` cập nhật ngôn ngữ domain; `codebase-design` làm rõ interface, seam và module. |

## Backend skills trong `be-demo`

Các skill sau đã có trong project. Dùng prompt tự nhiên theo chủ đề; `AGENTS.md` định tuyến tới skill tương ứng nếu agent hiện tại có skill đó. `domain-modeling` là skill global Matt Pocock, không phải skill cài riêng trong project.

| Skill                     | Chức năng và lúc dùng                                                                                                                                                                                                       | Prompt mẫu                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `nestjs-best-practices`   | Hướng dẫn kiến trúc và implementation NestJS: modules, dependency injection, controllers/services, security, performance, lỗi và testing. Dùng khi tạo, review hoặc refactor backend NestJS.                                | “Review module NestJS này, tập trung vào DI boundary và error handling.”                                            |
| `prisma-cli`              | Tra cứu/lựa chọn lệnh Prisma như validate, format, generate, migrate, db và Studio. Dùng cho thao tác CLI và migration; trước khi chạy lệnh ghi DB cần xác định môi trường đích.                                            | “Kiểm tra migration status và cho biết lệnh Prisma phù hợp để tạo migration này.”                                   |
| `prisma-client-api`       | Hướng dẫn Prisma Client CRUD, filters, relations, nested writes, transactions và raw SQL. Dùng khi viết hoặc review data access trong ứng dụng.                                                                             | “Viết truy vấn Prisma lấy đơn hàng kèm items, lọc theo trạng thái và phân trang.”                                   |
| `prisma-database-setup`   | Entry tương thích cũ trong bộ Prisma; nội dung hướng sang tài liệu/setup mới hơn. Không xem đây là hướng dẫn chính cho lệnh migration; ưu tiên `prisma-cli` cho CLI và `prisma-client-api` cho query.                       | “Đọc skill `prisma-database-setup` và xác định hướng dẫn hiện hành cho Prisma 7 trong repo.”                        |
| `vitest`                  | Tham chiếu tests, mocks, coverage, configuration và chọn/lọc test. Dùng khi viết hoặc sửa unit test hay cấu hình Vitest.                                                                                                    | “Viết Vitest test cho trường hợp service ném lỗi, dùng mock phù hợp với pattern hiện tại.”                          |
| `docker-compose-patterns` | Hướng dẫn service, health checks, dependency order, volumes, networks, environment và overrides. Dùng khi chỉnh hoặc debug Compose local.                                                                                   | “Review Docker Compose của backend, kiểm tra health check cho PostgreSQL và Redis.”                                 |
| `api-security-review`     | Rà soát API theo OWASP, gồm authentication/authorization và rủi ro ở route/API config. Dùng mặc định cho review code/spec chỉ đọc; kiểm thử chủ động chỉ khi được yêu cầu rõ ràng, có quyền và target cô lập trong phạm vi. | “Review các route đăng nhập và phân quyền theo OWASP API Security Top 10; chỉ đọc code, chưa chạy payload/scanner.” |
| `domain-modeling`         | Làm rõ thuật ngữ domain, entity boundary và quan hệ; cập nhật `GLOSSARY.md`/ADR khi quyết định đã rõ. Dùng khi khái niệm nghiệp vụ đang mơ hồ hoặc chồng nghĩa.                                                             | “Làm rõ khác biệt giữa Order status và Payment status, rồi đề xuất cập nhật glossary.”                              |

`prisma-database-setup` là compatibility entry, không thay thế quy ước Prisma của repo. Với thay đổi schema/migration, đọc các tài liệu domain/convention liên quan và kiểm tra `DATABASE_URL`; chỉ áp dụng migration lên database khi người dùng cho phép. Với OWASP, không chạy kiểm thử chủ động lên production hoặc hệ thống không được phép.

## Danh mục đầy đủ

### Plugin 1.3.2 — Engineering (20)

- **`ask-matt`** — Định tuyến tình huống tới skill hoặc workflow phù hợp, từ idea-to-ship đến bug, triage, architecture và các tác vụ độc lập; đọc skill liên quan trước khi đề xuất.
- **`grill-with-docs`** — Phỏng vấn lặp để mài yêu cầu/thiết kế, làm rõ từ vựng domain và ghi quyết định vào `GLOSSARY.md` hoặc ADR khi phù hợp.
- **`to-spec`** — Tổng hợp hội thoại và hiểu biết codebase thành spec gồm vấn đề, giải pháp, stories, quyết định implement/test và phần loại trừ; xuất bản lên tracker mà không mở vòng phỏng vấn mới.
- **`to-tickets`** — Chia plan/spec thành ticket tracer-bullet theo lát cắt dọc, xác định blocker, hỏi phần thiếu và xuất bản lên tracker.
- **`triage`** — Đưa issue/PR bên ngoài qua các trạng thái phân loại và xác minh; có thể hỏi thêm yêu cầu, rồi tạo brief cho agent/người, yêu cầu thông tin hoặc đóng mục.
- **`wayfinder`** — Vẽ bản đồ các ticket quyết định cho công việc quá lớn để hoàn tất trong một session, giải từng quyết định có blocker; đầu ra là quyết định để tiến tới implementation.
- **`implement`** — Thực hiện ticket/spec trong context hiện tại hoặc mới; làm rõ ticket, dùng TDD tại seam đã thống nhất, chạy typecheck/test, review và commit.
- **`implement-spec`** — Điều phối toàn bộ spec qua ticket graph/frontier, subagent và worktree; tích hợp về một nhánh, chạy review cuối, cập nhật ticket/PR và dọn worktree.
- **`tdd`** — Phát triển theo vòng đỏ→xanh tại public interface đã thống nhất, kiểm tra hành vi thay vì chi tiết implementation và làm từng lát cắt dọc.
- **`prototype`** — Tạo prototype logic/UI có thể chạy nhưng bỏ đi sau đó, để kiểm chứng state model, logic hoặc hướng thiết kế trước khi quyết định build thật.
- **`diagnosing-bugs`** — Tìm nguyên nhân bug khó hoặc regression bằng vòng phản hồi tái hiện ngắn; tái hiện, thu hẹp, instrument và kiểm chứng thay vì đoán trước.
- **`code-review`** — Review diff từ commit/branch/tag/base rõ ràng theo hai trục Standards và Spec, thường chạy subagent song song rồi báo findings cạnh nhau.
- **`retro`** — Nhìn lại một session và đề xuất cải thiện navigation, automated checks, coding standards, chỉ dẫn agent, tool economy hoặc thông tin; không sửa code sản phẩm.
- **`domain-modeling`** — Làm rõ thuật ngữ mơ hồ/chồng nghĩa, kiểm tra bằng tình huống domain, cập nhật `GLOSSARY.md` và tạo/chỉnh ADR khi có quyết định đáng ghi.
- **`codebase-design`** — Cung cấp từ vựng và nguyên tắc deep module để thiết kế interface, seam, adapter, testability, locality và khả năng điều hướng code.
- **`improve-codebase-architecture`** — Quét codebase tìm cơ hội đào sâu module, trình bày ứng viên trong báo cáo HTML và phỏng vấn để chọn một cải tiến.
- **`pr`** — Soạn PR body gồm Summary, Evidence và Merge Danger; chọn visual ngắn nhất giúp hiểu diff và đánh giá rủi ro/khả năng đảo ngược khi merge.
- **`research`** — Giao background agent điều tra bằng nguồn tin cậy/primary sources, kiểm chứng claim và lưu báo cáo Markdown có trích dẫn trong hoặc cạnh repo.
- **`wizard`** — Sinh Bash wizard tương tác đã kiểm chứng để hướng dẫn các bước cần con người làm như provisioning, credentials, dashboard, migration/cutover; không tự làm thay các bước đó.
- **`setup-matt-pocock-skills`** — Cấu hình repo một lần cho các skill engineering: issue tracker, triage labels, bố cục tài liệu domain và quy ước agent skill.

### Plugin 1.3.2 — Productivity (7)

- **`grill-me`** — Dùng phương pháp `grilling` để phỏng vấn mài sắc kế hoạch/thiết kế khi không cần trạng thái repo hay tài liệu glossary/ADR tại chỗ.
- **`grilling`** — Phỏng vấn theo vòng và decision frontier: hỏi các câu đã đủ điều kiện, đề xuất mặc định, tìm sự thật qua nghiên cứu và để người dùng quyết định.
- **`handoff`** — Nén hội thoại thành handoff Markdown tạm thời cho agent/người khác, có tóm tắt, artifact, skill gợi ý và redaction dữ liệu nhạy cảm.
- **`teach`** — Tạo workspace học nhiều session với kế hoạch, bài tập, lesson, ghi chú/tài liệu và theo dõi fluency/kiến thức.
- **`to-questionnaire`** — Khi câu trả lời nằm ở người khác, xác định người nhận và khoảng trống cần hỏi rồi tạo questionnaire để họ điền.
- **`wait-what`** — Dừng luồng khi câu trả lời chưa rõ, hỏi thêm context và diễn giải lại bằng ngôn ngữ đơn giản dựa trên glossary của project.
- **`writing-for-agents`** — Hướng dẫn viết skill, `AGENTS.md`/`CLAUDE.md` và tài liệu được trỏ tới sao cho rõ điều kiện tải, phân tầng thông tin và giảm nội dung thừa.

### Cài riêng ngoài plugin — Misc (4)

- **`git-guardrails-claude-code`** — Cài Claude Code hooks chặn trước các thao tác Git nguy hiểm như push, reset, clean hoặc xoá branch; cấu hình phạm vi và xác minh hook.
- **`migrate-to-shoehorn`** — Chuyển test fixtures/assertion dùng `as` sang `@total-typescript/shoehorn` (`fromPartial()`/`fromAny()`), giữ nguyên setup còn lại và kiểm tra kết quả.
- **`scaffold-exercises`** — Tạo cây thư mục bài tập gồm section/problem/solution/explainer cùng metadata và file cần thiết, bảo đảm qua lint.
- **`setup-pre-commit`** — Nhận diện package manager rồi thiết lập Husky/lint-staged, Prettier, typecheck và test làm kiểm tra trước commit.

### In-progress (8)

- **`chief-of-staff`** — Làm DRI cho mục tiêu dài hạn: điều phối subagent/lịch chạy, duy trì wiki có liên kết và ghi mốc thời gian, cải thiện môi trường agent theo tiến độ.
- **`claude-handoff`** — Tóm tắt và redact context, lưu handoff tạm thời rồi khởi chạy Claude background agent với nhiệm vụ tiếp tục đã đặt tên.
- **`loop-me`** — Phỏng vấn để khám phá các workflow lặp lại, chuyển chúng thành đặc tả trong `workflows/` và giữ `NOTES.md` làm nơi lưu facts/thuật ngữ.
- **`setup-ts-deep-modules`** — Cấu hình dependency-cruiser cho TypeScript để chỉ lộ entry point, kiểm tra boundary/cycle, thêm ví dụ và chứng minh rule qua lượt fail/pass.
- **`software-factory`** — Chuẩn hoá từ vựng và thiết kế factory gồm task, trigger, run, runner, service, orchestrator, brake, ticket source và observability.
- **`writing-beats`** — Từ chất liệu đã có, chọn các nhịp nội dung có căn cứ, cùng người dùng viết từng nhịp và dừng ở điểm kết tự nhiên.
- **`writing-fragments`** — Khám phá chất liệu bằng phỏng vấn và ghi nối tiếp các fragment đa dạng vào file Markdown thô, chưa ép thành cấu trúc.
- **`writing-shape`** — Đọc kho chất liệu thô, chọn góc viết, kiểm chứng khái niệm và định hình bài riêng theo từng đoạn/khối.
