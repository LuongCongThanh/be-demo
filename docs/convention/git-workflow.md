# Git Workflow

Quy ước branching strategy và cách làm việc với Git áp dụng cho repository này.

> CI và local hooks được cấu hình trong repository. Branch protection là cấu hình phía GitHub; cần kiểm tra trực tiếp trong repository settings thay vì suy ra từ tài liệu này.

Mục tiêu của workflow:

- Giữ `main` luôn ổn định và sẵn sàng deploy production.
- Dùng `dev` làm nhánh tích hợp cho quá trình phát triển.
- Mọi feature, bug fix, chore và documentation đều thực hiện trên branch riêng.
- Hạn chế conflict và giúp code review rõ ràng.
- Không push trực tiếp vào các branch quan trọng (`main`, `dev`).

---

## 1. Branch Structure

Luồng phát triển chính:

```text
feature/* ─┐
fix/*     ─┼──────> dev ───────> main
chore/*   ─┤                       ▲
docs/*    ─┘                       │
                               hotfix/*
```

- **`main`**: nhánh production, luôn ổn định.
- **`dev`**: nhánh integration cho development, checkout ra từ `main`.
- **`feature/*`, `fix/*`, `chore/*`, `docs/*`**: checkout ra từ `dev`, merge ngược lại `dev`.
- **`hotfix/*`**: checkout trực tiếp từ `main` để xử lý lỗi production khẩn cấp (xem mục 9 — chỉ áp dụng khi dự án đã có môi trường production thật).
- **`master`**: nhánh legacy, xem mục 15.

---

## 2. Branch Responsibilities

### `main`

`main` là nhánh production chính thức của repository.

Yêu cầu:

- Luôn ở trạng thái ổn định, sẵn sàng release/deploy.
- Không commit hoặc push trực tiếp vào `main`.
- Mọi thay đổi vào `main` phải thông qua Pull Request.
- Chỉ nhận code từ `dev` hoặc `hotfix/*`.

```text
dev → Pull Request → main → Production
```

### `dev`

`dev` là nhánh integration chính, được khởi tạo từ `main` và tồn tại lâu dài trong repository.

Dùng để tích hợp feature, bug fix, chore/refactor trước khi release.

Không commit hoặc push trực tiếp vào `dev` — mọi thay đổi đi qua Pull Request từ branch riêng.

```text
feature/user-authentication → Pull Request → dev
```

---

## 3. Development Branches

Các branch phát triển thông thường (`feature/*`, `fix/*`, `chore/*`, `docs/*`) đều được tạo từ `dev`:

```text
dev → working branch → development → commit → push → Pull Request → review → merge → dev
```

---

## 4. Branch Naming Convention

Tên branch sử dụng: tiếng Anh, lowercase, `kebab-case`, ngắn gọn nhưng mô tả đúng mục đích.

Tên branch không yêu cầu task ID; pre-push hook kiểm tra prefix và định dạng kebab-case.

| Loại công việc    | Prefix     | Ví dụ                             |
| ----------------- | ---------- | --------------------------------- |
| Feature mới       | `feature/` | `feature/user-authentication`     |
| Bug fix           | `fix/`     | `fix/login-redirect-error`        |
| Maintenance       | `chore/`   | `chore/update-eslint-config`      |
| Documentation     | `docs/`    | `docs/update-readme`              |
| Production hotfix | `hotfix/`  | `hotfix/payment-processing-error` |

Không nên sử dụng:

```text
feature/UserAuthentication
feature/user_authentication
feature/newFeature
feature/test
fix/bug
```

---

## 5. Feature Development Workflow

**Bước 1 — Cập nhật `dev`:**

```bash
git checkout dev
git pull origin dev
```

**Bước 2 — Tạo feature branch:**

```bash
git checkout -b feature/user-authentication
```

**Bước 3 — Development:** code trên feature branch, không code trực tiếp trên `dev`/`main`.

**Bước 4 — Commit:** commit theo từng thay đổi logic, tránh gom nhiều thay đổi không liên quan vào một commit.

```bash
git add .
git commit -m "feat: implement user authentication"
```

**Bước 5 — Push branch:**

```bash
git push -u origin feature/user-authentication
```

**Bước 6 — Sync với `dev` mới nhất** trước khi mở/merge Pull Request:

```bash
git checkout dev
git pull origin dev

git checkout feature/user-authentication
git rebase dev
```

Nếu có conflict: sửa file → `git add <file>` → `git rebase --continue`.

Sau khi rebase branch đã từng push:

```bash
git push --force-with-lease
```

Không dùng `git push --force` nếu không thực sự cần thiết — `--force-with-lease` an toàn hơn vì Git kiểm tra remote branch trước khi ghi đè.

---

## 6. Pull Request Workflow

```text
feature/* → Pull Request → dev
```

Pull Request phải:

- Mô tả rõ thay đổi.
- Không còn unresolved conflict.
- Có kết quả review được ghi nhận; với repository có nhiều contributor, cần approval theo branch protection.
- Không chứa code/debug không cần thiết.
- Tất cả CI check bắt buộc phải pass trước khi merge.

---

## 7. Merge Strategy

**Feature branch → `dev`**: dùng **Squash and Merge**.

Ví dụ trong feature branch có nhiều commit nhỏ:

```text
feat: create login form
fix: correct validation
fix: resolve lint
fix: address review
```

Sau khi squash vào `dev`, chỉ còn 1 commit:

```text
feat: implement user authentication
```

Điều này giúp lịch sử `dev` gọn và dễ đọc.

**`dev` → `main`**: dùng **Merge Commit** để giữ dấu mốc release rõ ràng (ví dụ `Merge pull request #124 from dev`).

---

## 8. Release Workflow

Khi `dev` đã ổn định và sẵn sàng release:

```text
dev → Pull Request → (CI) → Review → Approve → main → Production
```

Không merge `dev` vào `main` nếu có lỗi rõ ràng, review chưa xong hoặc CI thất bại. Production chỉ được deploy từ `main`.

---

## 9. Hotfix Workflow

> Chỉ áp dụng khi có môi trường production thật đang chạy.

`hotfix/*` dùng cho bug nghiêm trọng đang xảy ra trên production. Tạo trực tiếp từ `main` (không tạo từ `dev`):

```bash
git checkout main
git pull origin main
git checkout -b hotfix/payment-processing-error

# fix xong
git commit -m "fix: resolve payment processing error"
git push -u origin hotfix/payment-processing-error
```

Mở Pull Request `hotfix/* → main`. Sau khi merge và production đã được fix, **phải sync fix này ngược lại `dev`** (merge `main` vào `dev`, hoặc cherry-pick commit fix) để bug không bị mất trong phiên bản development tiếp theo:

```text
main → hotfix/* → Pull Request → main → Production
                                    │
                                    └──> sync → dev
```

**`fix/*` vs `hotfix/*`**: `fix/*` dùng cho bug thông thường trong development, tạo từ `dev` và merge vào `dev`. `hotfix/*` chỉ dùng cho bug nghiêm trọng đang xảy ra trên production, tạo từ `main`, merge vào `main` rồi sync về `dev`.

---

## 10. Delete Branch After Merge

Sau khi Pull Request đã được merge và branch không còn dùng (`feature/*`, `fix/*`, `chore/*`, `docs/*`, `hotfix/*`), nên xoá để repo không tồn đọng branch cũ:

```bash
git push origin --delete feature/user-authentication
git branch -d feature/user-authentication
```

---

## 11. Commit Message Convention

Commit message ngắn gọn, mô tả đúng thay đổi, theo Conventional Commits. Các type hiện được `commitlint.config.mjs` cho phép:

```text
feat: implement user authentication
fix: resolve login redirect error
refactor: simplify authentication service
test: add login integration tests
docs: update authentication documentation
chore: update eslint configuration
```

| Prefix     | Mục đích                               |
| ---------- | -------------------------------------- |
| `feat`     | Feature mới                            |
| `fix`      | Bug fix                                |
| `refactor` | Refactor code                          |
| `test`     | Thêm hoặc sửa test                     |
| `docs`     | Documentation                          |
| `chore`    | Maintenance/configuration              |
| `style`    | Formatting/style không ảnh hưởng logic |
| `perf`     | Performance improvement                |
| `ci`       | Thay đổi CI                            |
| `build`    | Thay đổi build system/dependency       |
| `revert`   | Revert commit trước                    |
| `security` | Thay đổi liên quan đến bảo mật         |

---

## 12. AI Tool Attribution

Commit message **không được** chứa attribution hoặc metadata của AI/tool/agent, ví dụ:

```text
Generated by Claude
Co-Authored-By: Claude
Co-Authored-By: Codex
Co-Authored-By: Copilot
Co-Authored-By: ChatGPT
AI-generated
```

Commit chỉ ghi nhận người thực hiện và chịu trách nhiệm cho thay đổi:

```text
feat: implement authentication flow
```

thay vì:

```text
feat: implement authentication flow

Generated by Claude
Co-Authored-By: Claude
Co-Authored-By: Codex
Co-Authored-By: Copilot
```

---

## 13. General Rules

- Không dùng `git push --force`; nếu cần cập nhật branch đã push sau rebase, dùng `--force-with-lease`.
- Không merge Pull Request nếu conflict chưa resolve, review còn yêu cầu thay đổi hoặc CI thất bại.
- Không gom nhiều feature không liên quan vào cùng một branch (vd. tránh `feature/auth-and-dashboard-and-payment`, nên tách riêng từng branch).

---

## 14. Hook local, CI & Branch Protection

### Hook local (husky)

| Hook         | Chạy                                                               | Chặn khi                                                                              |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `pre-commit` | `npm run agents:check`, `npm run git-policy:test` và `lint-staged` | Agent config không đồng bộ, Git/PR policy lỗi, hoặc staged file không qua lint/format |
| `commit-msg` | `commitlint` (`commitlint.config.mjs`)                             | Sai Conventional Commits, header > 100 ký tự, có AI attribution (mục 12)              |
| `pre-push`   | Kiểm tra branch, `typecheck`, `test`                               | Push thẳng `main`/`dev`/`master`; tên branch sai mục 4; typecheck/test lỗi            |

Node theo `.nvmrc` (`nvm use`).

### CI (`.github/workflows/`)

- `ci.yml` — chạy trên mọi PR và push vào `dev`/`main`: kiểm tra agent config, commit-message policy, lint, typecheck, unit test + coverage, e2e trên Postgres và schema/migration drift, OpenAPI contract, Markdown link, build và Docker build.
- `pr-title.yml` — tiêu đề PR phải theo Conventional Commits, vì Squash and Merge dùng nó làm commit message.
- `pr-body.yml` — kiểm tra cấu trúc PR body và yêu cầu ghi kết quả code review.
- Dependabot (`.github/dependabot.yml`) — mở PR cập nhật `npm`, GitHub Actions, `Dockerfile`, Docker Compose vào `dev` hằng tuần. `pr-body.yml` bỏ qua PR do `dependabot[bot]` tạo. `commitlint` bỏ qua commit Dependabot (header `chore|ci(deps…): bump` kèm trailer `Signed-off-by: dependabot[bot]`, xem `isDependabotCommit` trong `scripts/git-policy.mjs`), kể cả sau khi squash-merge; khi sửa message squash, giữ nguyên header và trailer đó.

Template: `.github/pull_request_template.md`. Task theo dõi ở `docs/plan/`.

### Branch Protection (cấu hình phía GitHub)

Branch protection không được kiểm chứng từ file trong repository. Trong GitHub settings, xác nhận `main`/`dev` yêu cầu Pull Request, block force push và require các check thích hợp từ `ci.yml`, `pr-title.yml`, `pr-body.yml` (bao gồm `agent-config`, `commit-message-policy`, `lint`, `typecheck`, `unit-test`, `e2e-test`, `openapi-contract`, `docs-links`, `build`, `conventional-title`, `template-sections`).

Hook local có thể bị bỏ qua bằng `--no-verify`; branch protection là lớp chặn phía remote nếu đã bật.

---

## 15. Legacy `master` Branch

`master` là branch legacy, được giữ lại để tránh phá vỡ CI/CD pipeline cũ, external integration, link/automation cũ, và historical reference. **Không dùng `master` cho development mới.**

Branch trunk là `main`; xác nhận default branch và branch protection trực tiếp trong GitHub settings.
