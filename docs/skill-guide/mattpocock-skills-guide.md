# Bộ Skill "mattpocock/skills" — đã cài, ý nghĩa & cách dùng

> Nguồn: https://github.com/mattpocock/skills — tác giả Matt Pocock (aihero.dev). Một plugin Claude Code đóng gói sẵn các "skill" (quy trình làm việc chuẩn hoá) cho vòng đời phát triển phần mềm thật: từ đào sâu ý tưởng → viết spec/ticket → code test-first → review → xử lý bug/conflict.

## 0. Xác nhận đã cài — không cần cài lại

Plugin này **đã được cài và bật sẵn**, cả ở mức global lẫn mức project này:

```jsonc
// ~/.claude/settings.json (global)
"enabledPlugins": { "mattpocock-skills@mattpocock": true },
"extraKnownMarketplaces": {
  "mattpocock": { "source": { "source": "github", "repo": "mattpocock/skills" } }
}

// D:\my-doc\project\nestjs-demo\.claude\settings.json (project)
"enabledPlugins": { "mattpocock-skills@mattpocock": true }
```

Code thật của plugin nằm ở cache local:

```
C:\Users\<user>\.claude\plugins\cache\mattpocock\mattpocock-skills\1.2.3\
```

Muốn kiểm tra lại/cài trên máy khác: mở Claude Code → `/plugin` → marketplace `mattpocock` (repo `mattpocock/skills`) → cài plugin `mattpocock-skills`. Không cần `git clone` tay — Claude Code tự fetch từ GitHub qua cơ chế marketplace.

Repo khai báo **25 skill "chính thức"** trong `plugin.json` (đã cài), chia 2 nhóm thư mục: `skills/engineering/` (17 skill) và `skills/productivity/` (8 skill). Ngoài ra repo còn thư mục `skills/in-progress/` (6 skill: `claude-handoff`, `implement-spec`, `loop-me`, `retro`, `setup-ts-deep-modules`, `writing-beats`/`writing-fragments`/`writing-shape`) — **các skill này CHƯA được khai trong `plugin.json`** nên **chưa cài/chưa dùng được**, tác giả còn đang thử nghiệm. Bảng bên dưới chỉ liệt kê 25 skill đã cài thật.

---

## 1. Bức tranh tổng: đây không phải 25 skill rời rạc, mà là 1 sơ đồ luồng

Skill `ask-matt` (đã cài, gọi bằng `Skill({ skill: "ask-matt" })` hoặc theo tên đã map trong session) chính là **bản đồ router** giải thích cách 25 skill nối với nhau. Tóm tắt lại luồng chính ("idea → ship"):

```
grill-with-docs (đào sâu ý tưởng, có ghi CONTEXT.md/ADR)
        │
        ├─ câu hỏi cần chạy thử mới trả lời được? → handoff → prototype → handoff về
        │
        ├─ việc nhỏ, xong trong 1 session?  → implement (chạy tdd bên trong, rồi code-review)
        │
        └─ việc lớn, nhiều session?  → to-spec → to-tickets → (mỗi ticket) implement
```

Hai "on-ramp" (điểm vào khác ngoài luồng chính):

- **`triage`** — khi có bug report/feature request "thô" từ bên ngoài dồn lại → biến thành ticket sẵn sàng cho `implement`.
- **`wayfinder`** — khi việc quá lớn, mù mờ (dự án mới toanh/tính năng khổng lồ) → lập "bản đồ quyết định" trước, xong mới gộp vào `to-spec`.

Việc bảo trì (không phải feature mới):

- **`improve-codebase-architecture`** — quét codebase tìm chỗ nên "đào sâu" (deepen module), chọn 1 chỗ thì quay lại `grill-with-docs`.

2 lớp "từ vựng" chạy ngầm bên dưới các skill khác (tự các skill trên gọi tới khi cần, ít khi gọi trực tiếp):

- **`domain-modeling`** — làm rõ thuật ngữ nghiệp vụ (vd: "account" đang bị dùng cho 3 nghĩa khác nhau).
- **`codebase-design`** — từ vựng thiết kế module sâu (deep module): interface, seam, adapter, locality.

Còn lại là các skill **standalone** (đứng riêng, không nằm trên luồng): `grill-me`, `grilling`, `resolving-merge-conflicts`, `prototype`, `research`, `to-questionnaire`, `wizard`, `wait-what`, `teach`, `writing-for-agents`.

Và 1 skill tiền đề: **`setup-matt-pocock-skills`** — chạy **1 lần duy nhất** trước khi dùng bất kỳ skill "engineering" nào, để cấu hình issue tracker/nhãn triage/cấu trúc doc mà các skill khác giả định đã có sẵn.

---

## 2. Bảng chi tiết 25 skill

### Nhóm `engineering/` (17 skill)

| Skill                                                                      | Ý nghĩa                                                                                                                                                                                                                        | Dùng khi nào                                                                                                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **`setup-matt-pocock-skills`**                                             | Cấu hình 1 lần: issue tracker, nhãn triage, cấu trúc doc.                                                                                                                                                                      | Trước khi dùng lần đầu bất kỳ skill engineering nào trong repo.                                                                               |
| **`ask-matt`**                                                             | Router/bản đồ — không tự làm gì, chỉ trỏ đúng skill nên dùng.                                                                                                                                                                  | Khi không nhớ nên dùng skill nào cho tình huống hiện tại.                                                                                     |
| **`grill-with-docs`**                                                      | Phỏng vấn dồn dập để mài sắc 1 ý tưởng/thiết kế, đồng thời ghi lại `../../CONTEXT.md` + ADR khi phát sinh quyết định khó đảo ngược.                                                                                            | Bắt đầu **mọi** feature mới, khi đang đứng trong 1 working directory (có repo để ghi lại).                                                    |
| **`grill-with-docs` → `to-spec`** _(bước kế tiếp, không phải skill riêng)_ |                                                                                                                                                                                                                                |                                                                                                                                               |
| **`to-spec`**                                                              | Gộp cả cuộc hội thoại vừa "grill" thành 1 spec, đẩy lên issue tracker — không phỏng vấn thêm, chỉ tổng hợp lại.                                                                                                                | Sau khi đã thống nhất đủ ý ở `grill-with-docs`, việc đủ lớn cần spec chính thức (không làm gọn trong 1 session).                              |
| **`to-tickets`**                                                           | Cắt spec thành các ticket kiểu "tracer-bullet" (mỗi ticket khai rõ ticket nào chặn/nằm trước nó).                                                                                                                              | Ngay sau `to-spec`, khi việc phải chia làm nhiều session/nhiều người làm.                                                                     |
| **`implement`**                                                            | Cài đặt 1 ticket/spec: bên trong tự chạy `tdd` (từng lát cắt đỏ→xanh), xong thì tự chạy `code-review` trước khi commit.                                                                                                        | Bắt tay code 1 ticket cụ thể — dùng lệnh này thay vì tự code tay từng bước.                                                                   |
| **`tdd`**                                                                  | Chuẩn "thế nào là 1 test tốt": test qua public interface, không test implementation detail, không viết hàng loạt test trước rồi mới code (horizontal slicing) — làm từng lát cắt dọc (1 test → 1 implementation).              | Muốn code 1 hành vi cụ thể theo kiểu test-first, không cần cả bộ spec/ticket.                                                                 |
| **`code-review`**                                                          | Review diff theo **2 trục song song**: Standards (đúng coding convention repo chưa) và Spec (đúng yêu cầu ticket/issue gốc chưa) — chạy 2 sub-agent song song rồi báo cáo cạnh nhau.                                           | Sau khi code xong 1 nhánh/PR, hoặc user yêu cầu "review since <commit/branch>".                                                               |
| **`resolving-merge-conflicts`**                                            | Xử lý conflict merge/rebase **đang dở dang**, từng hunk một, giải quyết theo **ý định** (trace về nguồn gốc thay đổi mỗi bên) chứ không chọn bừa 1 bên — **không bao giờ** tự `--abort`.                                       | Đang giữa 1 conflict merge/rebase thật (không phải để "phòng ngừa" trước).                                                                    |
| **`diagnosing-bugs`**                                                      | Vòng lặp chẩn đoán cho bug khó: không suy đoán khi chưa có 1 "vòng lặp phản hồi chặt" (1 lệnh tái hiện lỗi đỏ ngay lập tức), sửa xong luôn kèm regression test.                                                                | User nói "debug"/"diagnose", hoặc báo cáo cái gì đó bị lỗi/chậm/crash không rõ nguyên nhân ngay.                                              |
| **`triage`**                                                               | Đưa issue/PR bên ngoài qua "state machine" các vai trò triage: phân loại, xác minh, grill nếu cần, viết brief sẵn sàng cho agent.                                                                                              | Có đống bug report/feature request "thô" dồn lại chưa xử lý — **không** dùng cho ticket đã do `to-tickets` sinh ra (đã sẵn sàng rồi).         |
| **`wayfinder`**                                                            | Lập "bản đồ" các ticket-quyết-định trên issue tracker cho việc **quá lớn, còn mù mờ** (dự án mới/tính năng khổng lồ), giải từng quyết định cho tới khi thấy rõ đường đi — kết quả là **quyết định**, không phải sản phẩm cuối. | Việc lớn tới mức không thể "grill" gọn trong 1 session. Không dùng cho feature đã scope rõ ràng.                                              |
| **`improve-codebase-architecture`**                                        | Quét codebase, xuất báo cáo HTML trực quan các "cơ hội đào sâu" (deepening opportunity), chọn 1 cái thì "grill" tiếp về nó.                                                                                                    | Có thời gian rảnh muốn dọn/cải thiện kiến trúc, không phải làm feature.                                                                       |
| **`domain-modeling`**                                                      | Xây & mài từ vựng miền nghiệp vụ của project: chất vấn thuật ngữ mơ hồ, gỡ từ bị dùng chồng nghĩa, ghi quyết định khó đảo ngược thành ADR.                                                                                     | Đang bàn thuật ngữ codebase, viết/sửa `../../CONTEXT.md`, hoặc ghi/sửa ADR.                                                                   |
| **`codebase-design`**                                                      | Từ vựng chung để thiết kế "deep module": module, interface, depth, seam, adapter, leverage, locality — nhiều hành vi ẩn sau 1 interface nhỏ, gọn tại 1 seam sạch.                                                              | Muốn thiết kế/cải thiện interface của 1 module, tìm chỗ nên tách seam, hoặc `tdd`/`improve-codebase-architecture` cần dùng chung từ vựng này. |
| **`prototype`**                                                            | Viết 1 chương trình nhỏ, **dùng 1 lần rồi bỏ**, chỉ để trả lời 1 câu hỏi thiết kế (state model có ổn không, UI nên trông thế nào). Code vẫn giữ lại trên nhánh `prototype/<name>` làm "nguồn tham khảo gốc".                   | Câu hỏi thiết kế khó trả lời trên giấy — cần chạy thử mới biết.                                                                               |
| **`research`**                                                             | Giao việc đọc tài liệu cho 1 **background agent**: điều tra theo nguồn gốc đáng tin cậy (primary source), để lại file Markdown có trích dẫn trong repo.                                                                        | Cần tra cứu API/docs/kiến thức nền, muốn vừa làm việc khác vừa để agent đọc song song.                                                        |
| **`wizard`**                                                               | Sinh ra 1 bash script tương tác, dẫn **con người** đi qua từng bước chỉ con người mới làm được (cấp hạ tầng, tạo credential/CI secret, thao tác 1 dashboard bên thứ 3, chạy 1 migration/cutover 1 lần).                        | Agent gặp bước chỉ con người mới bấm/nhập được — **không** dùng nếu agent tự làm được.                                                        |

### Nhóm `productivity/` (8 skill)

| Skill                    | Ý nghĩa                                                                                                                                                                                         | Dùng khi nào                                                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`grill-me`**           | Giống hệt `grill-with-docs` (phỏng vấn dồn dập để mài ý tưởng) nhưng **không lưu trạng thái** — không tạo `../../CONTEXT.md`, không cần đứng trong 1 repo.                                      | Đang mài 1 kế hoạch/thiết kế/bài viết mà **không** có working directory nào để ghi lại (nếu có repo, luôn ưu tiên `grill-with-docs` vì nó để lại "giấy trắng mực đen"). |
| **`grilling`**           | Nguyên lý gốc của việc "grill": chia vòng phỏng vấn, xác định "frontier" (ranh giới hiểu biết), agent chỉ nêu **sự thật**, còn **quyết định** luôn thuộc về người dùng.                         | `grill-me`/`grill-with-docs` là 2 lối vào có tên của skill này; gọi thẳng skill này khi chỉ muốn phỏng vấn thuần, không cần wrapper nào khác.                           |
| **`handoff`**            | Nén cuộc hội thoại hiện tại thành 1 file markdown di động để agent/người khác tiếp tục.                                                                                                         | Chuyển việc sang: 1 harness mới, 1 thư mục mới, 1 đồng nghiệp, hoặc tách 1 việc phụ ra giữa chừng.                                                                      |
| **`teach`**              | Dạy 1 khái niệm/kỹ năng qua **nhiều session**, dùng thư mục hiện tại làm không gian làm việc có trạng thái.                                                                                     | Muốn học dần 1 chủ đề, không phải xong trong 1 lần chat.                                                                                                                |
| **`to-questionnaire`**   | Biến 1 quyết định bạn không tự trả lời được thành 1 bảng câu hỏi để **người khác** điền — skill này phỏng vấn ngược lại bạn về **cách gửi** (gửi cho ai, cần gì) chứ không phỏng vấn về chủ đề. | Thứ đang chặn bạn nằm trong đầu **người khác**, không nằm trong đầu bạn hay trong codebase.                                                                             |
| **`wait-what`**          | "Dừng lại, câu vừa rồi chưa rõ" — bắt agent giải thích lại đúng thứ vừa nói bằng tiếng Việt/tiếng Anh đơn giản, dùng từ vựng đã có trong `../../CONTEXT.md`.                                    | Giữa bất kỳ skill nào khác, khi 1 câu trả lời của agent không "vào" được.                                                                                               |
| **`writing-for-agents`** | Tài liệu tham khảo cho việc viết **cho agent đọc**: skill, `AGENTS.md`, các doc mà agent sẽ được trỏ tới.                                                                                       | Đang tạo/sửa 1 skill, hoặc sửa `AGENTS.md`/`../../CLAUDE.md`.                                                                                                           |

> 3 skill dưới đây nằm trong repo gốc ở thư mục `skills/misc/` — **cũng đã được cài** (có trong `plugin.json`) nhưng thiên về tiện ích hạ tầng hơn là quy trình làm việc:

| Skill                            | Ý nghĩa                                                                                                                         | Dùng khi nào                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **`git-guardrails-claude-code`** | Cài Claude Code hook để **chặn trước** các lệnh git nguy hiểm (`push`, `reset --hard`, `clean`, `branch -D`, …) trước khi chạy. | Muốn Claude Code không bao giờ tự chạy lệnh git phá huỷ mà không hỏi.                     |
| **`migrate-to-shoehorn`**        | Chuyển các file test đang dùng ép kiểu `as` sang thư viện `@total-typescript/shoehorn`.                                         | Repo dùng TypeScript, muốn thay `as` trong test bằng dữ liệu test "một phần" an toàn hơn. |
| **`setup-pre-commit`**           | Cài Husky pre-commit hook kèm `lint-staged` (Prettier), type-check, chạy test.                                                  | Muốn tự động format/type-check/test mỗi lần commit.                                       |
| **`scaffold-exercises`**         | Sinh cấu trúc thư mục bài tập (section/problem/solution/explainer) qua được lint.                                               | Đang xây khoá học/bài giảng code, cần bộ khung bài tập.                                   |

_(3 skill trên nằm ngoài 17+8 = 25 skill "engineering + productivity" nêu ở trên, tổng cộng repo cài **28 skill dùng được**; 6 skill còn lại trong `skills/in-progress/` không được khai trong `plugin.json` nên chưa cài.)_

---

## 3. Áp dụng cụ thể vào project `nestjs-demo` này

Đối chiếu với các việc đã/đang làm trong `doc/PLAN.md` và các doc ecommerce đã viết:

| Việc đã/sẽ làm trong project                                                                                        | Skill nên dùng                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bắt đầu 1 tính năng ecommerce mới (vd: "thêm tính năng review sản phẩm")                                            | `grill-with-docs` — phỏng vấn để chốt rõ yêu cầu trước khi code, tự ghi lại vào `../../CONTEXT.md`/ADR.                                             |
| Thuật ngữ ecommerce còn mơ hồ (vd: "status" của Order vs Cart vs Product nghĩa khác nhau)                           | `domain-modeling` — đã từng áp dụng ngầm khi review thiết kế enum ở `../../doc/ecommerce-postgresql-database-summary.md`.                           |
| Việc lớn hơn 1 session (vd: toàn bộ module Orders + Checkout + Payment)                                             | `to-spec` → `to-tickets` → `implement` từng ticket.                                                                                                 |
| Viết `ProductsService`/`OrdersService` mới (đã phác thảo CRUD ở `ecommerce-prisma-schema-guide.md` Phần 2)          | `tdd` — viết test theo seam (interface public của service) trước, rồi mới code, đúng tinh thần "vertical slice" thay vì viết hết test rồi mới code. |
| Trước khi merge nhánh `chore/remove-todo-module` (đã làm ở phiên trước) vào `dev`                                   | `code-review` — review theo Standards + Spec trước khi merge, thay vì merge thẳng.                                                                  |
| Gặp conflict khi merge nhánh feature vào `dev` sau này                                                              | `resolving-merge-conflicts` — xử lý từng hunk theo ý định gốc, không dùng `--abort`.                                                                |
| Thiết kế lại `PrismaService`/module pattern cho "deep module" (đã bàn ở Bước 21 `ecommerce-prisma-schema-guide.md`) | `codebase-design` — từ vựng seam/interface/depth để đánh giá module đã đủ "sâu" chưa.                                                               |
| Bug khó (vd: race-condition trừ tồn kho ở Bước 31 tài liệu Prisma)                                                  | `diagnosing-bugs` — chạy tới khi có vòng lặp tái hiện lỗi ổn định, sửa kèm regression test.                                                         |
| Muốn chặn Claude Code tự `git push`/`reset --hard` khi thao tác branch                                              | `git-guardrails-claude-code` — nên cài sớm cho project này vì đã có thao tác tạo/xoá nhánh thủ công.                                                |
| Muốn tự động format + type-check + test mỗi lần commit                                                              | `setup-pre-commit`.                                                                                                                                 |

**Gợi ý bước đầu tiên nếu muốn dùng nghiêm túc bộ skill này:** chạy `setup-matt-pocock-skills` 1 lần để cấu hình issue tracker/label cho project (skill này sẽ tự hỏi bạn dùng tracker nào — kể cả tracker nội bộ dạng file `.scratch/<feature>/issues/` nếu không có Jira/Linear).
