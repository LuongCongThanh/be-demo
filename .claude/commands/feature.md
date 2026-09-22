---
description: 'Discover → Spec → (Tickets) → Implement/TDD → Verify cho một feature/fix, theo Matt Pocock skill family, trước khi chạy /ship (Review → Ship). Dùng $ARGUMENTS làm mô tả yêu cầu.'
---

`/feature` dùng một skill family duy nhất — **Matt Pocock** (`grill-with-docs → to-spec → to-tickets → implement → tdd`) — để giữ tính nhất quán về state/artifact/naming giữa các bước, không trộn với methodology của Superpowers. Chỉ mượn từ Superpowers các skill **utility trung lập** (không cạnh tranh phase nào): `using-git-worktrees`, `systematic-debugging`, `verification-before-completion`, `subagent-driven-development`.

`/feature` không thay thế `/ship`: `/feature` kết thúc ở "implemented + verified", `/ship` bắt đầu từ "review".

## Escape hatch — việc thuần engineering-execution

Nếu task **không có business rule/behavior mới cần làm rõ** (migrate logger toàn repo, refactor cơ học, dọn kiến trúc, đổi thư viện...) — tức câu hỏi chính là "làm sao thực thi an toàn" chứ không phải "hệ thống nên hành xử thế nào" — thì `/feature` không phù hợp. Chạy tay chuỗi Superpowers thay vì qua `/feature`: `brainstorming → using-git-worktrees → writing-plans → executing-plans → tdd (hoặc test-driven-development) → code-review → finishing-a-development-branch`. Không dựng file/router riêng cho luồng này cho tới khi nó thực sự xảy ra thường xuyên trong repo.

## Bảng routing skill

| Tình huống                                      | Skill                               |
| ----------------------------------------------- | ----------------------------------- |
| Hiểu codebase/requirement trước khi code        | `mattpocock-skills:grill-with-docs` |
| Khảo sát rộng code hiện có                      | agent `Explore`                     |
| Domain rule/entity/quan hệ chưa rõ              | `mattpocock-skills:domain-modeling` |
| Chốt spec — nguồn plan duy nhất                 | `mattpocock-skills:to-spec`         |
| Phản biện spec/draft trước khi trình user       | `mattpocock-skills:grilling`        |
| Chia nhỏ việc lớn thành ticket (vertical slice) | `mattpocock-skills:to-tickets`      |
| Tách work khỏi working tree hiện tại            | `using-git-worktrees`               |
| Thực thi implement theo spec/ticket             | `mattpocock-skills:implement`       |
| Viết code theo TDD                              | `mattpocock-skills:tdd`             |
| Việc độc lập theo trách nhiệm/vertical slice    | `subagent-driven-development`       |
| Lỗi kỹ thuật/tooling bất ngờ                    | `systematic-debugging`              |
| Bug nghiệp vụ chưa rõ root cause                | `mattpocock-skills:diagnosing-bugs` |
| Trước khi báo "xong"                            | `verification-before-completion`    |

## Invariant

1. Không research cái đã biết rồi.
2. Không lập plan cho việc hiển nhiên/trivial.
3. Không code khi còn ambiguity chưa giải quyết.
4. Không chia một vertical behaviour thành ownership theo layer/file-type cho nhiều agent.
5. Không tự nhận "xong" khi chưa có bằng chứng verify mới (lint/typecheck/test thực sự chạy pass).
6. Không mượn skill khác family cho một phase family chính đã có (vd không dùng `writing-plans`/`executing-plans`/`test-driven-development`/`code-review` (Superpowers) song song với `to-spec`/`implement`/`tdd`/`code-review` (Matt) trong cùng `/feature`).

## Bước 0 — phân loại quy mô (theo blast radius, không theo số dòng)

Diff nhỏ không đồng nghĩa quick task — đổi 1 dòng `JWT_EXPIRES_IN`, CORS, rate limit, DB pool, feature flag vẫn có thể là Medium vì đổi behavior/security dù ít LOC.

- **Quick** — tất cả đúng: requirement hoàn toàn rõ, thay đổi cục bộ, không đổi public behavior/API contract/DB-schema-data/auth-security-permission, không ảnh hưởng nhiều module, rollback trivial.
  → Bỏ qua toàn bộ pipeline: viết test tối thiểu (nếu cần) → sửa code → `pnpm lint`/test phạm vi ảnh hưởng → báo user, gợi ý `/ship`.
- **Medium** (1 feature/fix, gói gọn 1 session): `grill-with-docs → to-spec → worktree → implement/tdd → verify`.
- **Large** (nhiều behavior, nhiều session): thêm `to-tickets` sau `to-spec`, tạo **một worktree cho cả feature** (không tạo worktree riêng từng ticket), rồi mỗi ticket lặp lại `implement/tdd → focused/full verify liên quan → lightweight review → commit` tuần tự trong cùng worktree đó, kết thúc bằng full verify cho toàn feature trước khi sang `/ship`.

Không chắc thuộc nhánh nào → hỏi user, không tự đoán để né chạy skill.

Với Medium/Large, thực hiện tuần tự, dừng lại xin xác nhận user ở cuối mỗi giai đoạn (trừ khi user yêu cầu autonomous):

### 1. Discover — `mattpocock-skills:grill-with-docs`

Mục tiêu: hiểu, chưa code. Thách thức business rule, API contract, validation, ràng buộc DB, race condition, test seam, error handling — dựa trên `CONTEXT.md`, `docs/adr/`, mục liên quan trong `docs/convention`, và `docs/<resource>-module-plan.md` nếu resource đã có.

Khảo sát rộng code hiện có → dùng agent `Explore` thay vì tự đọc tràn lan.

**Exit criteria** — dừng Discover khi đã xác định: (1) behavior hiện tại, (2) code path liên quan, (3) convention áp dụng được, (4) constraint/ADR liên quan, (5) module bị ảnh hưởng, (6) unknown còn chặn plan. Còn open question chặn plan → hỏi user, chưa sang bước 2.

### 2. Specify — `mattpocock-skills:to-spec`

`to-spec` là **nguồn plan duy nhất**; skill khác trong bước này chỉ thu thập input/phản biện, không tạo plan cạnh tranh.

- Chốt: behaviour, input/rule, success/failure case, test seam (ít nhất có thể — NestJS thường là `*.service.ts`), out-of-scope.
- Domain rule chưa rõ → `mattpocock-skills:domain-modeling` trước khi chốt, đưa kết quả vào lại spec.
- Spec phức tạp cần user cùng chỉnh nhiều vòng → `doc-coauthoring` để viết thành doc.
- Có bản nháp → `mattpocock-skills:grilling` để tự phản biện (edge case, giả định sai) trước khi trình user, sửa trực tiếp vào spec.
- Không sửa production code trong Discover/Specify; dùng chế độ read-only/planning của harness nếu có.

**Definition of Ready** — Execute chỉ bắt đầu khi: hành vi mong đợi rõ; scope/out-of-scope chốt; module/file ảnh hưởng xác định; thay đổi API/schema xác định; chiến lược migration xác định (nếu có); chiến lược test định nghĩa; edge case đã xử lý trong spec; user đã approve. Thiếu mục nào → quay lại `grilling`/hỏi user.

### 3. Slice (chỉ Large) — `mattpocock-skills:to-tickets`

Ticket = vertical slice / tracer bullet (một behaviour hoàn chỉnh xuyên DB→service→API→test), **không chia theo layer**. 1 ticket = 1 session = 1 vertical slice = 1 commit.

### 4. Isolate — `using-git-worktrees`

Tách work khỏi working tree hiện tại trước khi implement — **một worktree cho cả feature**, dùng chung cho toàn bộ ticket bên trong (không tạo worktree riêng từng ticket); các ticket chạy tuần tự trong cùng worktree, mỗi ticket kết thúc bằng một commit riêng.

### 5. Implement — `mattpocock-skills:implement` + `mattpocock-skills:tdd`

- TDD từng bước: RED (test fail trước, chỉ chạy focused test) → GREEN (code tối thiểu, verify lại bằng focused test) → REFACTOR (focused test + typecheck phạm vi ảnh hưởng). Full suite chỉ chạy ở gate bước 6 — verify cục bộ thường xuyên, verify toàn diện ở gate.
- Test behavior/capability (`it('rejects creating a category when slug already exists')`), không test implementation detail.
- Typecheck/lint liên tục theo phạm vi đang sửa.
- Việc độc lập → `subagent-driven-development`, chia theo **trách nhiệm/vertical slice hoàn chỉnh** (research convention, đánh giá rủi ro migration, implement trọn slice, review slice), **không chia theo file-type** (không tách agent viết DTO / agent viết test / agent viết service cho cùng một behaviour — chúng phụ thuộc chặt vào nhau, dễ lệch field/tên).
- Lỗi/behavior lạ ngoài dự kiến: implementation/test/tooling fail bất ngờ → `systematic-debugging`; bug nghiệp vụ/domain chưa rõ root cause → `mattpocock-skills:diagnosing-bugs`.
- Comment tiếng Việt (giải thích lý do), code + string runtime tiếng Anh. Không tự thêm abstraction/error-handling ngoài phạm vi task.
- **Large — cuối mỗi ticket**: chạy focused/full verify liên quan tới ticket đó, rồi tự đối chiếu lightweight với spec (đúng behaviour đã chốt ở bước 2, không sót edge case, không lệch acceptance criteria) — **không invoke `mattpocock-skills:code-review` ở đây**, chỉ tự-check nhanh trước khi commit và sang ticket kế tiếp. Full code-review vẫn để dành cho `/ship`.

### 6. Verify (gate toàn diện — cho cả feature, không phải từng ticket)

- Unit (business logic/service) → luôn có; Integration/API → khi động tới DB/HTTP layer; E2E → chỉ khi slice là luồng nghiệp vụ xuyên nhiều bước.
- Chạy đầy đủ `pnpm lint && pnpm typecheck && pnpm test` (+ `pnpm build` nếu convention yêu cầu).
- Trước khi báo "xong" → `verification-before-completion`: không tự nhận "done" theo cảm tính, phải có bằng chứng lint/typecheck/test thực sự pass.

Khi Verify xong cho toàn bộ feature (Medium: 1 slice; Large: tất cả ticket trong cùng worktree), báo user và gợi ý chạy `/ship` (review đầy đủ + rebase + PR nằm ở đó, không lặp lại ở `/feature`).

Ghi chú: verify ở bước 6 và verify trong `/ship` là hai state khác nhau — sau review fix/rebase/resolve conflict, `/ship` verify lại từ đầu, không dùng lại kết quả verify cũ của `/feature`.

### 7. Remember (tuỳ chọn, sau khi Verify pass)

Không phải phase family cạnh tranh với Matt Pocock (không tạo plan/spec mới) — chỉ ghi lại vào memory system sẵn có những gì **bất ngờ/non-obvious** vừa phát sinh trong Discover/Specify/Implement, để lần sau khỏi research lại hoặc lặp lại sai lầm/quyết định đã chốt. Ví dụ: domain rule dễ hiểu sai, convention hay bị áp dụng nhầm, quyết định user chốt khác với giả định ban đầu, root cause bất ngờ của bug.

- Không có gì bất ngờ đáng ghi → bỏ qua bước này, không ép viết memory cho việc hiển nhiên.
- Có → ghi 1-2 memory ngắn (loại `feedback` hoặc `project` tuỳ nội dung), không lặp lại thứ đã derive được từ code/spec/git history.
