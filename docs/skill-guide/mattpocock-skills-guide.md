# Bộ Skill "mattpocock/skills" — đã cài, ý nghĩa & cách dùng

> Nguồn: https://github.com/mattpocock/skills — tác giả Matt Pocock (aihero.dev). Một plugin Claude Code đóng gói sẵn các "skill" (quy trình làm việc chuẩn hoá) cho vòng đời phát triển phần mềm thật: từ đào sâu ý tưởng → viết spec/ticket → code test-first → review → viết PR → retro.
>
> **Phiên bản tài liệu này mô tả: `1.3.1`** (release 2026-10-04). Cập nhật lần cuối: 2026-10-06.

## 0. Cài đặt & cập nhật

Plugin **đã được cài và bật** ở mức global (user scope), lấy **trực tiếp từ marketplace của tác giả**:

```jsonc
// ~/.claude/settings.json (global)
"enabledPlugins": { "mattpocock-skills@mattpocock": true },
"extraKnownMarketplaces": {
  "mattpocock": { "source": { "source": "github", "repo": "mattpocock/skills" } }
}
```

Code thật của plugin nằm ở cache local:

```
C:\Users\<user>\.claude\plugins\cache\mattpocock\mattpocock-skills\1.3.1\
```

> ⚠️ **Đừng cài qua marketplace `claude-plugins-official`.** Bản trong marketplace chính thức của Anthropic pin theo 1 commit SHA cũ (tại 2026-10-06 vẫn là `1.2.3`), nên `claude plugin update` báo "already at the latest version" dù upstream đã lên 1.3.x. Marketplace `mattpocock` (repo `mattpocock/skills`) luôn lấy HEAD nhánh chính → có bản mới nhất.

Cài trên máy mới / chuyển từ bản official sang:

```bash
claude plugin marketplace add mattpocock/skills
claude plugin install mattpocock-skills@mattpocock --scope user
claude plugin uninstall mattpocock-skills@claude-plugins-official --scope user  # nếu từng cài bản official, tránh trùng skill
```

Cập nhật về sau:

```bash
claude plugin marketplace update mattpocock
claude plugin update mattpocock-skills@mattpocock
```

Tên plugin không đổi (`mattpocock-skills`) nên mọi tham chiếu dạng `mattpocock-skills:<skill>` (vd trong `.claude/commands/feature.md`) vẫn đúng. Cần **restart session Claude Code** để danh sách skill mới được nạp.

Repo khai báo **27 skill** trong `plugin.json` (đã cài), chia 2 nhóm: `skills/engineering/` (**20** skill) và `skills/productivity/` (**7** skill). Ngoài ra repo còn:

- `skills/misc/` (4 skill: `git-guardrails-claude-code`, `migrate-to-shoehorn`, `scaffold-exercises`, `setup-pre-commit`) — **không nằm trong `plugin.json`**, không đi kèm plugin. Trên máy này 4 skill này được cài riêng dạng symlink `~/.claude/skills/<name>` → `~/.agents/skills/<name>`.
- `skills/in-progress/` (6 skill: `claude-handoff`, `loop-me`, `setup-ts-deep-modules`, `writing-beats`, `writing-fragments`, `writing-shape`) — tác giả còn thử nghiệm, **chưa cài/chưa dùng được**.

---

## 1. Có gì mới ở 1.3.x (so với 1.2.3)

| Thay đổi                                                                   | Ảnh hưởng                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ➕ **`implement-spec`** (từ in-progress lên engineering)                   | Cài cả 1 spec trong 1 lần chạy: đọc ticket như **task graph**, chạy song song các implementer subagent (mỗi con 1 worktree) trên **frontier** ticket sẵn sàng, gom về 1 **integration branch**, cuối cùng chạy 1 `code-review`.                                                 |
| ➕ **`pr`** (mới)                                                          | Khuôn mẫu body PR: Summary (visual nhỏ nhất: pseudocode/call tree/file tree/Mermaid/diff) → Evidence before/after → Merge Danger (cửa 1 chiều hay 2 chiều + blast radius). Model-invoked: agent tự dùng khi viết PR.                                                            |
| ➕ **`retro`** (từ in-progress lên engineering)                            | Bước cuối của luồng chính: nhìn lại session và đề xuất sửa **môi trường** của agent (không sửa code): navigation pointer, automated check, coding standard, steering file, tool economy, information access.                                                                    |
| ➖ **`resolving-merge-conflicts`** bị **xoá**                              | Không có skill thay thế — tác giả cho rằng agent tự xử lý conflict merge/rebase đang dở được rồi.                                                                                                                                                                               |
| 🔁 **`CONTEXT.md` / `CONTEXT-MAP.md` → `GLOSSARY.md` / `GLOSSARY-MAP.md`** | Các skill (`domain-modeling`, `grill-with-docs`, `improve-codebase-architecture`, `setup-matt-pocock-skills`, `triage`, `tdd`, `diagnosing-bugs`, `ask-matt`, `codebase-design`, `wait-what`, `pr`) **chỉ còn tìm `GLOSSARY.md`**. Repo cũ cần `git mv CONTEXT.md GLOSSARY.md`. |
| `diagnosing-bugs` bỏ bước hand-off sang `improve-codebase-architecture`    | Phase 6 giờ chỉ còn "Cleanup". Sau khi fix xong, `ask-matt` gợi ý chạy `/retro` để hỏi "cái gì lẽ ra đã ngăn được bug này".                                                                                                                                                     |
| Gọi skill chéo bằng câu "Call the Skill tool with …"                       | Tăng tỉ lệ skill con được nạp thật (lỗi hay gặp nhất của `grill-with-docs` trước đây). Skill user-invoked (vd `setup-matt-pocock-skills`) không bị skill khác gọi nữa mà sẽ **nhắc bạn tự chạy**.                                                                               |
| `grilling` ngăn cách các câu hỏi bằng `---`                                | Dễ đọc hơn khi 1 vòng có nhiều câu hỏi.                                                                                                                                                                                                                                         |

> ⚠️ **Việc cần làm cho project này:** repo `be-demo` đang dùng `CONTEXT.md` ở root (và `CLAUDE.md`, `docs/agents/domain.md` đều trỏ tới `CONTEXT.md`). Với 1.3.x, các skill như `grill-with-docs`/`domain-modeling` sẽ **không thấy** file này và có thể tạo `GLOSSARY.md` mới song song. Nên `git mv CONTEXT.md GLOSSARY.md` và sửa các tham chiếu (làm trên 1 branch `chore/*` riêng).

---

## 2. Bức tranh tổng: đây không phải 27 skill rời rạc, mà là 1 sơ đồ luồng

Skill `ask-matt` (user-invoked, gõ `/ask-matt`) chính là **bản đồ router** giải thích cách các skill nối với nhau. Tóm tắt luồng chính ("idea → ship"):

```
grill-with-docs (đào sâu ý tưởng, ghi GLOSSARY.md/ADR)
        │
        ├─ câu hỏi cần chạy thử mới trả lời được? → handoff → prototype → handoff về
        │
        ├─ việc nhỏ, xong trong 1 session?  → implement (chạy tdd bên trong, rồi code-review)
        │
        └─ việc lớn, nhiều session?  → to-spec → to-tickets → 1 trong 2 cách:
                 ├─ implement từng ticket (/clear context giữa mỗi ticket)
                 └─ implement-spec (cả spec 1 lần, subagent song song, 1 integration branch)
        │
        ├─ mở PR → pr (agent tự dùng để viết body PR)
        │
        └─ retro (nhìn lại session, cải thiện môi trường cho lần build sau)
```

**Context hygiene:** giữ bước grill → to-spec → to-tickets trong **1 context window liền mạch** (đừng compact/clear trước khi xong `to-tickets`). Mỗi `implement` bắt đầu context mới từ ticket. Chạy `retro` **trong chính session** nó đang nhìn lại, trước khi clear.

Ba "on-ramp" (điểm vào khác ngoài luồng chính):

- **`triage`** — bug report/feature request "thô" từ bên ngoài dồn lại → biến thành ticket sẵn sàng cho `implement`. Không triage ticket do `to-tickets` sinh ra.
- **`diagnosing-bugs`** — bug khó (flake, regression). Fix xong → `retro` trong cùng session; nếu thiếu seam để khoá bug lại → `improve-codebase-architecture`.
- **`wayfinder`** — việc quá lớn, mù mờ (dự án mới toanh/tính năng khổng lồ) → lập "bản đồ quyết định" trước, xong mới nhập vào luồng chính ở `to-spec`.

Việc bảo trì (không phải feature mới):

- **`improve-codebase-architecture`** — quét codebase tìm chỗ nên "đào sâu" (deepen module), chọn 1 chỗ thì quay lại `grill-with-docs`.

2 lớp "từ vựng" chạy ngầm bên dưới (các skill khác tự gọi tới, ít khi gọi trực tiếp):

- **`domain-modeling`** — làm rõ thuật ngữ nghiệp vụ (vd: "account" đang bị dùng cho 3 nghĩa khác nhau), giữ `GLOSSARY.md` sạch.
- **`codebase-design`** — từ vựng thiết kế deep module: interface, seam, adapter, leverage, locality.

Các skill **standalone**: `grill-me`, `grilling`, `prototype`, `research`, `to-questionnaire`, `wizard`, `wait-what`, `teach`, `writing-for-agents`.

Skill tiền đề: **`setup-matt-pocock-skills`** — chạy **1 lần** trước khi dùng skill engineering nào, để cấu hình issue tracker/nhãn triage/cấu trúc doc.

**Ranh giới phase** (giữa các chặng trong 1 session) có 5 lựa chọn, theo thứ tự nên cân nhắc: **Continue** (ở lại) → **`/clear`** (khi không gì ở đây cần cho chặng sau) → **`/handoff`** (chỉ khi sang harness mới/thư mục mới/đồng nghiệp/tách việc phụ) → **subagent** (việc hẹp, lấy báo cáo về) → **`/compact`** (mặc định, nằm cuối cây).

---

## 3. Bảng chi tiết 27 skill

Cột **Gọi**: `user` = chỉ người dùng gõ `/<skill>` mới chạy (`disable-model-invocation: true`); `model` = agent có thể tự kích hoạt khi khớp mô tả.

### Nhóm `engineering/` (20 skill)

| Skill                               | Gọi   | Ý nghĩa                                                                                                                                                                                                                                                                                                                          | Dùng khi nào                                                                                   |
| ----------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **`setup-matt-pocock-skills`**      | user  | Cấu hình 1 lần: issue tracker, nhãn triage, cấu trúc doc.                                                                                                                                                                                                                                                                        | Trước khi dùng lần đầu bất kỳ skill engineering nào trong repo.                                |
| **`ask-matt`**                      | user  | Router/bản đồ — không tự làm gì, chỉ trỏ đúng skill/luồng nên dùng.                                                                                                                                                                                                                                                              | Khi không nhớ nên dùng skill nào cho tình huống hiện tại.                                      |
| **`grill-with-docs`**               | user  | Phỏng vấn dồn dập để mài sắc 1 ý tưởng/thiết kế, đồng thời ghi lại `GLOSSARY.md` + ADR khi phát sinh quyết định khó đảo ngược.                                                                                                                                                                                                   | Bắt đầu **mọi** feature mới, khi đang đứng trong 1 working directory.                          |
| **`to-spec`**                       | user  | Gộp cả cuộc hội thoại vừa "grill" thành 1 spec, đẩy lên issue tracker — không phỏng vấn thêm, chỉ tổng hợp.                                                                                                                                                                                                                      | Sau `grill-with-docs`, việc đủ lớn cần spec chính thức (không làm gọn trong 1 session).        |
| **`to-tickets`**                    | user  | Cắt spec thành các ticket kiểu "tracer-bullet", mỗi ticket khai rõ **blocking edge** (ticket nào chặn nó).                                                                                                                                                                                                                       | Ngay sau `to-spec`, khi việc phải chia nhiều session/nhiều người.                              |
| **`implement`**                     | user  | Cài đặt 1 ticket/spec: bên trong tự chạy `tdd` (từng lát cắt đỏ→xanh), xong tự chạy `code-review`.                                                                                                                                                                                                                               | Code 1 ticket cụ thể, hoặc việc nhỏ ngay trong context hiện tại.                               |
| **`implement-spec`** 🆕             | user  | Cài **cả spec** trong 1 lần: đọc ticket như task graph, chạy implementer subagent song song (mỗi con 1 worktree, build bằng `tdd`) trên frontier, merge fast-forward về 1 integration branch, kết bằng 1 `code-review`. Draft PR chỉ mở khi tracker đóng việc qua PR hoặc bạn yêu cầu.                                           | Khi muốn **điều phối** build thay vì tự lái từng ticket. Thay thế cho `implement` từng ticket. |
| **`tdd`**                           | model | Chuẩn "test tốt": test qua public interface, không test implementation detail, làm từng lát cắt dọc (1 test → 1 implementation) thay vì viết hàng loạt test trước.                                                                                                                                                               | Code 1 hành vi cụ thể theo kiểu test-first, không cần spec/ticket.                             |
| **`code-review`**                   | user  | Review diff theo **2 trục song song**: Standards (đúng convention repo) và Spec (đúng yêu cầu ticket/issue gốc) — 2 sub-agent chạy song song, báo cáo cạnh nhau.                                                                                                                                                                 | Sau khi code xong 1 nhánh/PR, hoặc "review since <commit/branch>".                             |
| **`pr`** 🆕                         | model | Khuôn body PR: **Summary** (visual nhỏ nhất làm rõ thay đổi), **Evidence** (before/after: output, screenshot, test đỏ→xanh), **Merge Danger** (cửa 1 chiều/2 chiều + blast radius). Phỏng theo `show-me` của Dex Horthy.                                                                                                         | Mỗi khi viết body PR — agent tự dùng.                                                          |
| **`retro`** 🆕                      | user  | Retrospective 1 session, đề xuất sửa **môi trường** agent: navigation, automated checks, coding standards, AGENTS.md, tool economy, no-op instructions, information access. Lỗi máy móc → check tự động (lint rule/pre-commit/CI); chỉ để `CODING_STANDARDS.md` cho việc cần phán đoán. Repo không có guardrail nào = 1 finding. | Sau 1 lần build, nhất là khi build bị trục trặc; sau khi fix bug bằng `diagnosing-bugs`.       |
| **`diagnosing-bugs`**               | model | Vòng lặp chẩn đoán bug khó: không suy đoán khi chưa có **vòng phản hồi chặt** (1 lệnh tái hiện lỗi đỏ ngay), sửa kèm regression test, tự redact secret trong output.                                                                                                                                                             | "debug"/"diagnose", hoặc thứ gì đó lỗi/chậm/crash không rõ nguyên nhân.                        |
| **`triage`**                        | user  | Đưa issue/PR bên ngoài qua "state machine" các vai trò triage: phân loại, xác minh, grill nếu cần, viết brief sẵn sàng cho agent.                                                                                                                                                                                                | Đống bug report/feature request "thô" — **không** dùng cho ticket từ `to-tickets`.             |
| **`wayfinder`**                     | user  | Lập "bản đồ" các ticket-quyết-định trên issue tracker cho việc **quá lớn, mù mờ**, giải từng quyết định tới khi thấy đường — kết quả là **quyết định**, không phải sản phẩm.                                                                                                                                                     | Việc lớn tới mức không "grill" gọn trong 1 session. Không dùng cho feature đã scope rõ.        |
| **`improve-codebase-architecture`** | user  | Quét codebase, xuất báo cáo HTML các "cơ hội đào sâu" (deepening opportunity), chọn 1 cái thì grill tiếp.                                                                                                                                                                                                                        | Có thời gian rảnh muốn dọn/cải thiện kiến trúc.                                                |
| **`domain-modeling`**               | model | Xây & mài từ vựng miền nghiệp vụ: chất vấn thuật ngữ mơ hồ, gỡ từ dùng chồng nghĩa, ghi quyết định khó đảo ngược thành ADR.                                                                                                                                                                                                      | Đang bàn thuật ngữ codebase, viết/sửa `GLOSSARY.md` hoặc ADR.                                  |
| **`codebase-design`**               | model | Từ vựng thiết kế "deep module": module, interface, depth, seam, adapter, leverage, locality.                                                                                                                                                                                                                                     | Thiết kế/cải thiện interface 1 module, tìm chỗ tách seam.                                      |
| **`prototype`**                     | model | Chương trình nhỏ **dùng 1 lần** để trả lời 1 câu hỏi thiết kế (logic → 1 file HTML tự chứa có state panel + walkthrough; UI → bản dựng UI). Giữ lại trên nhánh `prototype/<name>` làm primary source.                                                                                                                            | Câu hỏi thiết kế khó trả lời trên giấy.                                                        |
| **`research`**                      | model | Giao việc đọc tài liệu cho **background agent**: điều tra theo primary source, để lại file Markdown có trích dẫn trong repo.                                                                                                                                                                                                     | Cần tra API/docs/kiến thức nền, vừa làm việc khác vừa để agent đọc.                            |
| **`wizard`**                        | model | Sinh bash script tương tác dẫn **con người** qua các bước chỉ người làm được (cấp hạ tầng, tạo credential/CI secret, thao tác dashboard bên thứ 3, migration/cutover 1 lần), ghi giá trị vào `.env` và GitHub secrets.                                                                                                           | Agent gặp bước chỉ con người bấm/nhập được — **không** dùng nếu agent tự làm được.             |

### Nhóm `productivity/` (7 skill)

| Skill                    | Gọi   | Ý nghĩa                                                                                                                                                     | Dùng khi nào                                                                                                  |
| ------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **`grill-me`**           | user  | Giống `grill-with-docs` nhưng **không lưu trạng thái** — không tạo `GLOSSARY.md`, không cần repo.                                                           | Mài 1 kế hoạch/thiết kế/bài viết **không** có working directory (có repo thì luôn ưu tiên `grill-with-docs`). |
| **`grilling`**           | model | Nguyên lý gốc của "grill": chia vòng phỏng vấn, xác định "frontier", agent chỉ nêu **sự thật**, **quyết định** thuộc về người dùng.                         | `grill-me`/`grill-with-docs` là 2 lối vào có tên; gọi thẳng khi muốn phỏng vấn thuần, không wrapper.          |
| **`handoff`**            | user  | Nén cuộc hội thoại thành 1 file markdown di động để agent/người khác tiếp tục.                                                                              | Chuyển sang harness mới, thư mục mới, đồng nghiệp, hoặc tách việc phụ giữa chừng.                             |
| **`teach`**              | user  | Dạy 1 khái niệm/kỹ năng qua **nhiều session**, dùng thư mục hiện tại làm workspace có trạng thái.                                                           | Muốn học dần 1 chủ đề.                                                                                        |
| **`to-questionnaire`**   | user  | Biến 1 quyết định bạn không tự trả lời được thành bảng câu hỏi cho **người khác** điền — phỏng vấn bạn về **cách gửi** (gửi ai, cần gì), không về chủ đề.   | Thứ đang chặn bạn nằm trong đầu **người khác**.                                                               |
| **`wait-what`**          | user  | "Dừng lại, chưa rõ" — bắt agent giải thích lại bằng ngôn ngữ đơn giản, dùng từ vựng trong `GLOSSARY.md` (theo `GLOSSARY-MAP.md` nếu repo có nhiều context). | Giữa bất kỳ skill nào, khi 1 câu trả lời không "vào".                                                         |
| **`writing-for-agents`** | model | Tài liệu tham khảo cho việc viết **cho agent đọc**: skill, `AGENTS.md`, doc được trỏ tới.                                                                   | Tạo/sửa 1 skill, hoặc sửa `AGENTS.md`/`CLAUDE.md`. `retro` cũng gọi skill này làm style guide.                |

### Ngoài plugin: `skills/misc/` (4 skill, cài riêng)

Không đi kèm plugin. Trên máy này đã cài riêng ở `~/.claude/skills/` (symlink sang `~/.agents/skills/`), gọi bằng tên không prefix (vd `/setup-pre-commit`).

| Skill                            | Ý nghĩa                                                                                                                         | Dùng khi nào                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **`git-guardrails-claude-code`** | Cài Claude Code hook để **chặn trước** các lệnh git nguy hiểm (`push`, `reset --hard`, `clean`, `branch -D`, …) trước khi chạy. | Muốn Claude Code không bao giờ tự chạy lệnh git phá huỷ mà không hỏi.                |
| **`migrate-to-shoehorn`**        | Chuyển các file test đang dùng ép kiểu `as` sang thư viện `@total-typescript/shoehorn`.                                         | Repo TypeScript, muốn thay `as` trong test bằng dữ liệu test "một phần" an toàn hơn. |
| **`setup-pre-commit`**           | Cài Husky pre-commit hook kèm `lint-staged` (Prettier), type-check, chạy test.                                                  | Muốn tự động format/type-check/test mỗi lần commit.                                  |
| **`scaffold-exercises`**         | Sinh cấu trúc thư mục bài tập (section/problem/solution/explainer) qua được lint.                                               | Đang xây khoá học/bài giảng code, cần bộ khung bài tập.                              |

---

## 4. Áp dụng cụ thể vào project `be-demo` này

Đối chiếu với các việc đã/đang làm (⚠️ tham chiếu gốc `doc/PLAN.md` — file này không còn tồn tại, dead link có từ trước) và các doc ecommerce đã viết:

| Việc đã/sẽ làm trong project                                                                                        | Skill nên dùng                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bắt đầu 1 tính năng ecommerce mới (vd: "thêm tính năng review sản phẩm")                                            | `grill-with-docs` — phỏng vấn chốt yêu cầu trước khi code, tự ghi `GLOSSARY.md`/ADR (nhớ đổi tên `CONTEXT.md` → `GLOSSARY.md` trước, xem mục 1).                                     |
| Thuật ngữ ecommerce còn mơ hồ (vd: "status" của Order vs Cart vs Product nghĩa khác nhau)                           | `domain-modeling` — đã từng áp dụng ngầm khi review thiết kế enum ở `../ecommerce-postgresql-database-summary.md`.                                                                   |
| Việc lớn hơn 1 session (vd: toàn bộ module Orders + Checkout + Payment)                                             | `to-spec` → `to-tickets` → `implement` từng ticket, **hoặc** `implement-spec` để chạy song song cả spec trên 1 integration branch.                                                   |
| Viết `ProductsService`/`OrdersService` mới (đã phác thảo CRUD ở `ecommerce-prisma-schema-guide.md` Phần 2)          | `tdd` — viết test theo seam (interface public của service) trước, đúng tinh thần "vertical slice".                                                                                   |
| Trước khi mở PR từ branch feature vào `dev`                                                                         | `code-review` — review theo Standards + Spec (project rule cũng yêu cầu chạy `/code-review` trước khi mở PR).                                                                        |
| Viết body PR                                                                                                        | `pr` — Summary bằng visual + Evidence before/after (vd output `npm run test:e2e`) + Merge Danger (migration Prisma = cửa 1 chiều).                                                   |
| Sau khi xong 1 module (vd Products + Variants #21) hoặc 1 lần CI hỏng (vd thiếu `db:seed` trước e2e ở #22)          | `retro` — biến lỗi lặp lại thành check tự động (lint rule, pre-commit, CI step) thay vì thêm luật vào `CLAUDE.md`.                                                                   |
| Gặp conflict khi rebase nhánh feature lên `dev`                                                                     | Không còn skill riêng (`resolving-merge-conflicts` đã bị xoá ở 1.3.0) — để agent xử lý trực tiếp; nếu muốn có quy trình thì dùng `agentic-awesome-skills:resolving-merge-conflicts`. |
| Thiết kế lại `PrismaService`/module pattern cho "deep module" (đã bàn ở Bước 21 `ecommerce-prisma-schema-guide.md`) | `codebase-design` — từ vựng seam/interface/depth để đánh giá module đã đủ "sâu" chưa.                                                                                                |
| Bug khó (vd: race-condition trừ tồn kho ở Bước 31 tài liệu Prisma)                                                  | `diagnosing-bugs` — chạy tới khi có vòng lặp tái hiện lỗi ổn định, sửa kèm regression test, rồi `retro`.                                                                             |
| Muốn chặn Claude Code tự `git push`/`reset --hard` khi thao tác branch                                              | `git-guardrails-claude-code` (cài riêng, ngoài plugin).                                                                                                                              |
| Muốn tự động format + type-check + test mỗi lần commit                                                              | `setup-pre-commit` (cài riêng, ngoài plugin).                                                                                                                                        |

**Gợi ý bước đầu tiên nếu muốn dùng nghiêm túc bộ skill này:** chạy `setup-matt-pocock-skills` 1 lần để cấu hình issue tracker/label cho project (repo này đã có sẵn cấu hình ở `docs/agents/` — GitHub Issues qua `gh`, nhãn triage mặc định), rồi đổi `CONTEXT.md` → `GLOSSARY.md` để khớp quy ước 1.3.x.
