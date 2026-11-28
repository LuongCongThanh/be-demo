# Khả năng của oxlint để chặn import sai ranh giới

Type: docs/research
Status: resolved

## Question

oxlint (phiên bản trong `package.json`, cấu hình `oxlint.json`) có hỗ trợ `no-restricted-imports` với `patterns` (glob/regex) và `overrides` theo glob file đủ để biểu đạt: (1) `**/domain/**` cấm import `@nestjs/*`, `#src/infrastructure/*`, `#src/generated/*`; (2) controller cấm import `PrismaService`; (3) file trong `src/modules/<A>/` cấm import file nội bộ của `src/modules/<B>/`? Nếu không đủ, giới hạn cụ thể là gì, và phương án thay thế rẻ nhất (rule khác của oxlint, script grep trong CI, hoặc dependency-cruiser) là gì?

## Answer

Đã kiểm chứng thực nghiệm trên oxlint 1.81.0 (bản đang cài), bằng fixture và các config probe. Chi tiết, các config chạy được và nguồn nằm trong file findings `docs/plan/initiatives/src-wide-architecture-standard/research/04-oxlint-boundary-capability.md` trên branch local `docs/research-oxlint-boundary-capability` (commit `2e10ca8`, chưa push vì pre-push hook fail typecheck trong worktree thiếu `node_modules`).

- **Luật domain: hỗ trợ.** Đặt trong override `files: ["src/**/domain/**"]`, dùng `patterns[].group` với `**`: `["@nestjs/**", "#src/infrastructure/**", "#src/generated/**"]`. Nếu dùng `*` thì chỉ bắt con trực tiếp và để lọt `#src/infrastructure/database/prisma.service.js`.
- **Luật controller: hỗ trợ.** Override `**/*.controller.ts` với `paths: [{ name: "#src/infrastructure/database/prisma.service.js" }]`.
- **Luật giữa module: hỗ trợ một phần.** Phải viết override riêng cho từng module bằng phủ định trong `group`, ví dụ `["#src/modules/*/**", "!#src/modules/<A>/**"]`. Có thể thêm `"!#src/modules/*/index.js"` nếu muốn barrel là public. Không có cách viết chung cho "module khác". `regex` dùng engine Rust nên không hỗ trợ lookahead, và một pattern có lookahead **fail im lặng** (không báo lỗi, không match).
- **Override thay thế chứ không gộp.** Override thay toàn bộ cấu hình `no-restricted-imports` ở top-level cho file khớp. Khi nhiều override cùng khớp một file, chỉ override cuối cùng có hiệu lực. Vì vậy mỗi override phải lặp lại `paths` về permissions đang có, và file thuộc 2 nhóm luật (ví dụ `<module>/domain/**`) cần một override gộp đặt sau cùng. Override `"off"` hiện có cho `src/security/authorization/**` cũng tắt luôn các luật ranh giới cho thư mục đó.
- **Giới hạn khác:** chỉ so khớp chuỗi specifier, nên import tương đối vượt module sẽ không bị bắt. oxlint 1.81.0 in mỗi lỗi 2 lần (chỉ ảnh hưởng hiển thị).
- **Phương án thay thế** nếu cần luật chung cho mọi module: sinh override theo từng module bằng script từ danh sách `src/modules/*` (rẻ nhất, chưa thử), hoặc dùng dependency-cruiser (có back-reference `$1`, chưa chạy thử).
