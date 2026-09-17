# Hướng dẫn Skills & MCP đã cài đặt (global)

Tài liệu này liệt kê các skill/MCP đã được cài **toàn cục** (dùng được ở mọi project, mọi thư mục), nhóm theo **repo nguồn**, cùng chức năng, cách dùng và trường hợp phù hợp nhất. Cài đặt thực hiện ngày 2026-09-15.

## Vị trí cài đặt

- **Skills:** `C:\Users\SMD415 - ThanhLuong\.claude\skills\<tên-skill>\SKILL.md` — 100 skill đã copy từ 5 repo nguồn. Không có xung đột tên với các skill đã cài trước đó (mattpocock-skills, agentic-awesome-skills).
- **MCP:** `czlonkowski/n8n-mcp` được thêm bằng `claude mcp add --scope user n8n-mcp -- npx -y n8n-mcp` → có hiệu lực ở **user config**, dùng được mọi project. Trạng thái: đã kết nối (`✔ Connected`).
  - Hiện chạy ở chế độ **chỉ tra cứu tài liệu node/template** (không có `N8N_API_URL` / `N8N_API_KEY`). Muốn cho phép tạo/sửa/chạy thử workflow trên một instance n8n thật, chạy:
    `claude mcp add --scope user n8n-mcp -e N8N_API_URL=https://<instance>/api/v1 -e N8N_API_KEY=<key> -- npx -y n8n-mcp`
    (ghi đè server hiện có). Chỉ làm việc này trên môi trường n8n thử nghiệm trước.
  - Gọi bằng cách nhắc tới n8n / workflow / node trong hội thoại — Claude Code sẽ tự dùng tool MCP tương ứng, không cần `/` command.

## Cách gọi skill

Gõ `/<tên-skill>` (ví dụ `/refactoring-ui`), hoặc chỉ cần mô tả đúng nhu cầu — mô tả kích hoạt (trigger) trong `SKILL.md` sẽ khiến Claude tự chọn skill phù hợp mà không cần gõ lệnh.

---

## Repo 1/5 — `obra/superpowers` (14 skill): quy trình kỹ thuật phần mềm

| Skill                            | Chức năng                                                                                                                  | Dùng tốt nhất khi                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `brainstorming`                  | Bắt buộc chạy trước mọi việc "sáng tạo" (tính năng mới, component mới) để làm rõ ý định, yêu cầu, thiết kế trước khi code. | Trước khi bắt đầu một tính năng/thay đổi hành vi chưa rõ ràng.  |
| `writing-plans`                  | Biến spec/yêu cầu thành plan nhiều bước trước khi đụng code.                                                               | Task nhiều bước, cần checkpoint rõ ràng.                        |
| `executing-plans`                | Thực thi một plan đã viết sẵn, có điểm dừng để review.                                                                     | Tiếp tục một plan ở phiên làm việc khác.                        |
| `subagent-driven-development`    | Triển khai plan có các task độc lập ngay trong phiên hiện tại (không tách phiên).                                          | Plan có nhiều việc độc lập, muốn song song hoá trong 1 session. |
| `dispatching-parallel-agents`    | Giao 2+ việc độc lập (không phụ thuộc lẫn nhau) cho nhiều agent chạy song song.                                            | Có ≥2 task rời rạc, không chia sẻ state.                        |
| `test-driven-development`        | TDD: viết test trước khi viết code, cho mọi feature/bugfix.                                                                | Bất kỳ lúc nào viết code mới — mặc định nên bật.                |
| `systematic-debugging`           | Quy trình chẩn đoán có hệ thống trước khi đề xuất fix.                                                                     | Gặp bug, test fail, hoặc hành vi bất thường.                    |
| `verification-before-completion` | Bắt buộc chạy lệnh kiểm chứng (test/build) và đọc kết quả trước khi tuyên bố "đã xong".                                    | Trước khi commit, tạo PR, hoặc báo cáo hoàn thành.              |
| `requesting-code-review`         | Xin review sau khi hoàn thành task/feature lớn, trước khi merge.                                                           | Muốn xác nhận công việc đáp ứng yêu cầu trước khi merge.        |
| `receiving-code-review`          | Xử lý phản hồi code review một cách nghiêm túc (không đồng ý cho có), yêu cầu xác minh kỹ thuật thay vì làm theo mù quáng. | Nhận feedback không rõ ràng hoặc có vẻ sai kỹ thuật.            |
| `using-git-worktrees`            | Tạo workspace cô lập (git worktree) cho một nhánh việc mới.                                                                | Bắt đầu feature cần tách biệt khỏi workspace hiện tại.          |
| `finishing-a-development-branch` | Quyết định cách tích hợp nhánh khi việc đã xong và test pass.                                                              | Xong việc, cần merge/PR/dọn nhánh.                              |
| `using-superpowers`              | Meta-skill: thiết lập cách tìm và dùng skill khác ngay từ đầu hội thoại.                                                   | Tự động, không cần gọi tay.                                     |
| `writing-skills`                 | Viết/kiểm tra skill mới trước khi triển khai.                                                                              | Khi tự viết thêm skill cho project.                             |

> Lưu ý: bộ này **trùng chức năng** với `tdd`, `prototype`, `diagnosing-bugs`, `resolving-merge-conflicts` (mattpocock-skills) đã có sẵn — dùng bộ nào quen tay hơn, không cần chạy cả hai.

---

## Repo 2/5 — `anthropics/skills` (19 skill): công cụ & tài liệu chính thức Anthropic

| Skill                   | Chức năng                                                                                                                                       | Dùng tốt nhất khi                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `doc-coauthoring`       | Quy trình 3 giai đoạn: thu thập ngữ cảnh → xây dựng cấu trúc → **Reader Testing** (cho một phiên Claude mới đọc thử để tìm chỗ thiếu/khó hiểu). | Viết tài liệu hướng dẫn dev, spec, proposal — đúng nhu cầu README/hướng dẫn API mẫu. |
| `frontend-design`       | Định hướng thẩm mỹ, typography, tránh giao diện "mẫu có sẵn" khi build UI mới.                                                                  | Khám phá hướng thiết kế cho trang/màn hình mới.                                      |
| `webapp-testing`        | Test web app local bằng Playwright: chụp màn hình, xem console log.                                                                             | Xác minh frontend hoạt động đúng bằng trình duyệt thật.                              |
| `web-artifacts-builder` | Xây artifact HTML nhiều component phức tạp (React, Tailwind, shadcn/ui).                                                                        | Artifact cần state management/routing — không dùng cho artifact 1 file đơn giản.     |
| `docx`                  | Tạo/đọc/sửa file Word (.docx/.dotx): TOC, heading, tracked changes.                                                                             | Deliverable yêu cầu là file Word cụ thể.                                             |
| `pdf`                   | Đọc/tạo/gộp/tách/OCR file PDF.                                                                                                                  | Thao tác trực tiếp với file .pdf.                                                    |
| `pptx`                  | Tạo/sửa slide deck (.pptx/.potx), template, speaker notes.                                                                                      | Deliverable là bài thuyết trình.                                                     |
| `xlsx`                  | Tạo/sửa spreadsheet (.xlsx/.csv/.tsv), công thức, làm sạch dữ liệu bẩn.                                                                         | Deliverable chính là file spreadsheet.                                               |
| `theme-factory`         | Áp 10 theme màu/font có sẵn (hoặc tạo theme mới) cho artifact/slide/doc.                                                                        | Cần phong cách nhất quán nhanh cho một artifact.                                     |
| `brand-guidelines`      | Áp màu/typography thương hiệu Anthropic chính thức.                                                                                             | Chỉ dùng khi nội dung thực sự cần bộ nhận diện Anthropic.                            |
| `canvas-design`         | Tạo tác phẩm thị giác gốc (.png/.pdf) — poster, art tĩnh.                                                                                       | Cần poster/hình nghệ thuật gốc, không sao chép tác phẩm có sẵn.                      |
| `algorithmic-art`       | Generative/algorithmic art bằng p5.js (flow field, particle system, random có seed).                                                            | Yêu cầu "art bằng code", không sao chép tác giả khác.                                |
| `slack-gif-creator`     | Tạo GIF động tối ưu cho Slack.                                                                                                                  | Yêu cầu cụ thể "làm GIF cho Slack".                                                  |
| `internal-comms`        | Viết báo cáo nội bộ (status report, cập nhật lãnh đạo, FAQ, incident report) theo format công ty quen dùng.                                     | Cần viết thông báo/báo cáo nội bộ, không phải tài liệu kỹ thuật cho dev ngoài.       |
| `mcp-builder`           | Hướng dẫn xây MCP server chất lượng cao (Python FastMCP / Node MCP SDK).                                                                        | Tự viết MCP server tích hợp API ngoài.                                               |
| `skill-creator`         | Tạo/sửa/đo hiệu năng skill khác, tối ưu description để trigger đúng.                                                                            | Tự viết skill mới cho Claude Code.                                                   |
| `academy-guide`         | Gợi ý khoá học/tutorial phù hợp từ Claude Academy khi user hỏi cách dùng Claude.                                                                | Câu hỏi kiểu "làm sao để dùng tính năng X của Claude".                               |
| `claude-api`            | Tra cứu model id, giá, tham số, streaming, tool use, MCP, caching của Claude API.                                                               | Code tích hợp Anthropic SDK/API.                                                     |
| `discernment-nudge`     | Tự thêm 2-3 câu hỏi gợi mở sau khi đưa ra khuyến nghị/estimate/phân tích quan trọng.                                                            | Chạy tự động sau các câu trả lời có tính chất tư vấn/kết luận.                       |

---

## Repo 3/5 — `wondelai/skills` (65 skill): khung tư duy sản phẩm, UX, kinh doanh, kiến trúc

Repo lớn nhất, chia theo 4 nhóm con để dễ tra cứu.

### 3a. Kiến trúc & chất lượng code (12 skill)

| Skill                        | Chức năng                                                                                                                  | Dùng tốt nhất khi                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `clean-architecture`         | Dependency Rule: code phụ thuộc hướng vào trong (framework → use case → entity), ports & adapters.                         | Quyết định business logic nằm ở layer nào, tách khỏi DB/framework.              |
| `clean-code`                 | Đặt tên, hàm ngắn, xử lý lỗi sạch, SRP.                                                                                    | Review PR về khả năng đọc, dọn hàm lộn xộn.                                     |
| `domain-driven-design`       | Bounded context, aggregate, ubiquitous language, anti-corruption layer.                                                    | Tách monolith thành service, code không khớp với nghiệp vụ.                     |
| `software-design-philosophy` | Deep module vs shallow module, information hiding, complexity budget (John Ousterhout).                                    | Đánh giá một abstraction/API có "đáng" hay đang over-engineer.                  |
| `refactoring-patterns`       | Các phép refactor có tên (extract method, replace conditional…) không đổi hành vi.                                         | Dọn code smell cụ thể, chuẩn bị code cho tính năng mới.                         |
| `working-with-legacy-code`   | Kỹ thuật an toàn khi sửa code không có test (seam, characterization test, sprout/wrap).                                    | Codebase cũ không test, sợ đụng vào.                                            |
| `pragmatic-programmer`       | DRY, orthogonality, tracer bullet, design by contract, ước lượng, build-vs-buy.                                            | Quyết định kiến trúc có thể đảo ngược hay không, ước lượng công việc.           |
| `system-design`              | Thiết kế hệ thống phân tán: load balancing, cache, queue, ước lượng capacity.                                              | Thiết kế cho triệu người dùng, phỏng vấn system design.                         |
| `ddia-systems`               | Chọn/đánh giá datastore, replication, partitioning, consistency (Kleppmann).                                               | Chọn SQL/NoSQL, debug lag replication, thiết kế data pipeline.                  |
| `release-it`                 | Circuit breaker, bulkhead, retry, health check, capacity planning, zero-downtime deploy.                                   | Service hay crash, cần chống cascading failure.                                 |
| `team-topologies`            | 4 loại team, 3 interaction mode, Conway's law ngược.                                                                       | Tổ chức lại team kỹ thuật, tách monolith và quyết định ai sở hữu service nào.   |
| `technical-documentation`    | Audit/viết/sửa docs theo Google Developer Documentation Style Guide: giọng văn, heading, procedure, code sample, wordlist. | Review README, viết getting-started, API reference, changelog, migration guide. |

### 3b. Thiết kế UI/UX (11 skill)

| Skill                      | Chức năng                                                                                                 | Dùng tốt nhất khi                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `refactoring-ui`           | Audit & sửa visual hierarchy, spacing, màu sắc, độ sâu; quy trình grayscale-first, thang giá trị cố định. | Sửa UI đã có nhưng "trông amateur", cần polish trước khi launch.     |
| `ux-heuristics`            | Đánh giá usability theo 10 heuristics của Nielsen + luật Krug, phát hiện dark pattern.                    | Audit form, navigation, information architecture.                    |
| `design-everyday-things`   | Nguyên lý affordance, signifier, constraint, feedback, mental model (Don Norman).                         | Người dùng "không biết cách dùng", giao diện gây nhầm lẫn.           |
| `microinteractions`        | Thiết kế chi tiết nhỏ: trigger, rule, feedback, loop cho trạng thái nút/loading/toggle.                   | UI "cảm giác chết", cần thêm phản hồi tức thời.                      |
| `web-typography`           | Chọn/pha font, line-height, thang chữ, tối ưu tải web font.                                               | Chọn typeface, sửa văn bản khó đọc.                                  |
| `top-design`               | Thiết kế trải nghiệm web đẳng cấp Awwwards: scroll animation, parallax, typography kịch tính.             | Landing page/portfolio cần gây ấn tượng mạnh, không phải app nội bộ. |
| `steve-jobs-design-review` | Review sản phẩm/tính năng theo tiêu chuẩn tối giản, tập trung, "insanely great".                          | Cắt scope, quyết định tính năng nào nên bỏ trước khi ship.           |
| `ios-hig-design`           | Thiết kế native iOS theo Apple HIG (SwiftUI/UIKit, safe area, SF Symbols).                                | Build app iOS, cần "feel native".                                    |
| `high-perf-browser`        | Tối ưu hiệu năng web: HTTP/2-3, resource hints, critical rendering path, Core Web Vitals.                 | Site chậm, cần tối ưu TTFB/bundle size.                              |
| `design-sprint`            | Quy trình 5 ngày prototype + test với user thật.                                                          | Đội đang tranh cãi về quyết định rủi ro cao, cần de-risk nhanh.      |
| `lean-ux`                  | Thiết kế theo giả thuyết, sketch nhóm, thử nghiệm nhanh thay vì tài liệu nặng.                            | Giảm overhead tài liệu thiết kế, thúc đẩy cross-functional design.   |

### 3c. Chiến lược sản phẩm, khởi nghiệp & vận hành (19 skill)

| Skill                        | Chức năng                                                                                    | Dùng tốt nhất khi                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `jobs-to-be-done`            | Phân tích "job" khách hàng thuê sản phẩm để làm.                                             | Hiểu vì sao khách chọn đối thủ, định hình lại value proposition.               |
| `mom-test`                   | Phỏng vấn khách hàng không dẫn dắt.                                                          | Chuẩn bị câu hỏi phỏng vấn, tránh false-positive từ lời khen xã giao.          |
| `lean-startup`               | MVP, Build-Measure-Learn, quyết định pivot/persevere.                                        | Kiểm định ý tưởng rẻ nhất có thể trước khi build full.                         |
| `good-strategy-bad-strategy` | Kernel chiến lược: chẩn đoán − chính sách chủ đạo − hành động nhất quán (Rumelt).            | Audit chiến lược/pitch deck bị sáo rỗng, biến goal-list thành chiến lược thật. |
| `blue-ocean-strategy`        | Tạo thị trường không cạnh tranh qua ERRC framework.                                          | Thị trường quá đông đối thủ, cần khác biệt hoá.                                |
| `crossing-the-chasm`         | Chiến lược go-to-market từ early adopter sang mainstream.                                    | Tăng trưởng chững lại sau nhóm khách hàng đầu tiên.                            |
| `obviously-awesome`          | Positioning canvas: alternatives, unique attribute, market category.                         | Prospect không hiểu sản phẩm giải quyết gì.                                    |
| `cold-start-problem`         | 5 giai đoạn network effect cho sản phẩm hai chiều.                                           | Marketplace/mạng xã hội chưa có ai dùng (chicken-and-egg).                     |
| `hundred-million-offers`     | Value Equation, bonus stacking, guarantee, khan hiếm có đạo đức.                             | Khách nói "quá đắt", cần đóng gói offer hấp dẫn hơn.                           |
| `monetizing-innovation`      | Định giá theo willingness-to-pay đã kiểm chứng, packaging good-better-best.                  | Nghi ngờ đang định giá sai, thiết kế pricing page.                             |
| `predictable-revenue`        | Xây outbound sales machine (SDR/AE/CSM), Cold Calling 2.0.                                   | Xây team sales B2B từ đầu, cần lấp pipeline.                                   |
| `traction-eos`               | Entrepreneurial Operating System: V/TO, quarterly rocks, Level 10 meeting.                   | Công ty đang tăng trưởng nhưng "hỗn loạn", cần meeting cadence.                |
| `high-output-management`     | Đòn bẩy quản lý, 1:1, OKR, task-relevant maturity (Andy Grove).                              | Mới lên quản lý, cần cấu trúc lịch họp/review hiệu suất.                       |
| `drive-motivation`           | Động lực nội tại: Autonomy-Mastery-Purpose.                                                  | Gamification không hiệu quả, đội ngũ mất động lực.                             |
| `negotiation`                | Tactical empathy, calibrated questions, Ackerman method.                                     | Đàm phán lương/hợp đồng/giá, đối tác không nhượng bộ.                          |
| `continuous-discovery`       | Nhịp phỏng vấn khách hàng hàng tuần, Opportunity Solution Tree.                              | Team build liên tục nhưng không ai dùng, cần nối discovery với roadmap.        |
| `inspired-product`           | Team sản phẩm "empowered" (Marty Cagan), dual-track discovery/delivery.                      | Roadmap chỉ là feature list, cần cấu trúc lại team theo outcome.               |
| `lean-analytics`             | Chọn/audit chỉ số startup (OMTM, vanity metrics, benchmark theo mô hình kinh doanh).         | Chưa biết nên đo KPI nào, dashboard toàn vanity metric.                        |
| `37signals-way`              | Triết lý sản phẩm gọn nhẹ Basecamp: six-week cycle, appetite thay vì estimate, "build less". | Đội nhỏ, muốn ship nhanh, cắt scope thay vì roadmap dài hạn.                   |

### 3d. Marketing, tăng trưởng, chuyển đổi (7 skill)

| Skill                  | Chức năng                                                  | Dùng tốt nhất khi                                              |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| `contagious`           | STEPPS framework tạo viral/word-of-mouth.                  | Thiết kế tính năng dễ chia sẻ, referral program.               |
| `made-to-stick`        | SUCCESs checklist cho thông điệp dễ nhớ.                   | Pitch deck, tagline, giải thích sản phẩm phức tạp cho dễ hiểu. |
| `storybrand-messaging` | Đặt khách hàng làm "hero" trong narrative brand.           | Sửa copy trang chủ, email nurture, thông điệp thiếu nhất quán. |
| `one-page-marketing`   | Kế hoạch marketing full-funnel từ stranger → raving fan.   | Chưa biết bắt đầu marketing từ đâu.                            |
| `cro-methodology`      | Audit landing page, thiết kế A/B test dựa trên bằng chứng. | Landing page không convert, cần giả thuyết test cụ thể.        |
| `influence-psychology` | 7 nguyên tắc thuyết phục có đạo đức (Cialdini).            | Copy chưa thuyết phục, cần social proof/urgency đúng mực.      |
| `scorecard-marketing`  | Quiz/scorecard funnel để lead-gen 30-50% conversion.       | Cần lead magnet dạng self-assessment/calculator.               |

### 3e. Retention & hành vi người dùng (2 skill)

| Skill               | Chức năng                                                                 | Dùng tốt nhất khi                                       |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `hooked-ux`         | Hook Model: Trigger-Action-Reward-Investment cho thói quen dùng sản phẩm. | User không quay lại, cần vòng lặp engagement.           |
| `improve-retention` | Behavior design B=MAP, activation, cohort retention.                      | User đăng ký rồi biến mất, cần giảm friction kích hoạt. |

### 3f. "Guided journey" — meta-skill điều phối nhiều skill khác (14 skill)

Nhóm này **không làm việc trực tiếp** mà chạy tuần tự nhiều skill ở mục 3a-3e, hỏi người dùng ở mỗi bước và ghi kết quả vào `docs/` để resume qua nhiều phiên. Chỉ nên gọi khi thực sự muốn một hành trình đầy đủ nhiều giai đoạn — nếu chỉ cần một khung riêng lẻ, gọi thẳng skill con.

| Skill                       | Dùng khi                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `create-business`           | Có ý tưởng, chưa có khách hàng trả tiền — cần validate + định vị + pricing.            |
| `create-app`                | Xây app mới từ đầu, muốn kiến trúc đúng ngay từ MVP.                                   |
| `create-website`            | Xây website/landing page mới từ con số 0.                                              |
| `grow-business`             | Đã có khách hàng trả tiền nhưng doanh thu thất thường, cần growth engine lặp lại được. |
| `grow-app`                  | App có người dùng nhưng bỏ đi, cần vòng lặp activation/retention.                      |
| `grow-website`              | Site đã có traffic nhưng under-convert, cần tăng trưởng có nghiên cứu.                 |
| `improve-business`          | Doanh nghiệp chững lại, cần chẩn đoán chiến lược/vận hành.                             |
| `improve-app`               | App đã ship nhưng "rough", cần polish UX/copy.                                         |
| `improve-website`           | Site đang chạy nhưng hiệu suất kém, cần backlog fix theo bằng chứng.                   |
| `design-code-architecture`  | Thiết kế kiến trúc cho app mới (chỉ phần kiến trúc, không phải toàn bộ sản phẩm).      |
| `architecture-optimization` | Codebase chạy được nhưng chậm dần, cần đo & tối ưu có hệ thống.                        |
| `remove-technical-debt`     | Codebase cũ, to, ai cũng sợ đụng vào.                                                  |
| `improve-code-quality`      | Prototype "vibe-coded" chạy được nhưng không có test, cần production-ready.            |
| `conversion-optimization`   | Một flow cụ thể (signup/checkout/onboarding) đang rò rỉ conversion.                    |

---

## Repo 4/5 — `blader/humanizer` (1 skill)

| Skill       | Chức năng                                                                                                                               | Dùng tốt nhất khi                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `humanizer` | Sửa văn phong nghe "như AI viết" (cấu trúc "not X but Y", câu kết sáo rỗng, liệt kê bộ ba, gạch ngang tràn lan…) mà không đổi nội dung. | Vòng biên tập cuối, sau khi nội dung kỹ thuật đã đúng — không dùng để sửa code/CLI/số liệu/business rules. |

---

## Repo 5/5 — `hardikpandya/stop-slop` (1 skill)

| Skill       | Chức năng                                                                                                                       | Dùng tốt nhất khi                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `stop-slop` | Loại bỏ các "tell" văn phong AI theo rubric 5 tiêu chí (trực tiếp, nhịp điệu, tôn trọng người đọc, tự nhiên, mật độ thông tin). | Rà một bài viết bị dài dòng/nhiều câu thừa — áp dụng có chọn lọc, không máy móc cho văn kỹ thuật cần giải thích từng bước. |

---

## MCP (không phải skill) — `czlonkowski/n8n-mcp`

Đây là **MCP server**, không nằm trong thư mục skills — cấu hình toàn cục qua `claude mcp add --scope user`. Cung cấp cho Claude công cụ tra cứu node/tài liệu n8n, kiểm tra cấu hình workflow, và (khi gắn `N8N_API_URL`/`N8N_API_KEY`) tạo/sửa/chạy thử workflow trên một instance n8n thật. Dùng khi bạn build automation bằng n8n — không cần gọi thủ công, chỉ cần mô tả workflow cần build.

---

## Gợi ý theo tình huống của bạn (Next.js/NestJS + viết tài liệu dev)

- **Viết/soát tài liệu hướng dẫn dev:** `doc-coauthoring` (anthropics — kiểm tra người đọc hiểu được không) + `technical-documentation` (wondelai — chuẩn văn phong Google style) → sau đó `humanizer` để mượt câu chữ.
- **Triển khai API, debug, đảm bảo chất lượng:** `brainstorming` → `writing-plans` → `test-driven-development` → `systematic-debugging` (khi có lỗi) → `verification-before-completion` trước khi báo "xong" (đều thuộc obra/superpowers).
- **Review UI đã có:** `refactoring-ui` + `ux-heuristics` (wondelai).
- **Thiết kế UI mới:** `frontend-design` (anthropics) hoặc `design-sprint`/`lean-ux` (wondelai) nếu cần test với user trước.
- **Kiến trúc NestJS/service boundary:** `clean-architecture` + `domain-driven-design` (wondelai); nếu là codebase cũ thì `working-with-legacy-code` hoặc `remove-technical-debt`.
- **Tự động hoá n8n:** dùng trực tiếp — mô tả workflow cần build, MCP `n8n-mcp` sẽ tự được gọi để tra node/param.

## Ghi chú bảo trì

- Gỡ một skill: xoá thư mục tương ứng trong `C:\Users\SMD415 - ThanhLuong\.claude\skills\`.
- Gỡ MCP n8n: `claude mcp remove n8n-mcp -s user`.
- Cập nhật skill lên bản mới của repo gốc: clone lại repo và ghi đè thư mục skill tương ứng (các skill này là bản sao tĩnh, không tự động cập nhật).
