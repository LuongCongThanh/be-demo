# Git Workflow

Quy ước branching strategy và cách làm việc với Git áp dụng cho repository này.

> Lưu ý: đây là dự án cá nhân (học NestJS), không phải team lớn. Tài liệu này mô tả **những gì thực sự áp dụng ngay** và đánh dấu rõ phần nào là **mục tiêu/TODO** (CI, branch protection) chưa được thiết lập tại thời điểm viết.

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
- **`master`**: nhánh legacy, xem mục 16.

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

Các branch phát triển thông thường (`feature/*`, `fix/*`, `chore/*`, `docs/*`) đều được tạo từ `dev`.

Luồng chung:

```text
dev → working branch → development → commit → push → Pull Request → review → merge → dev
```

---

## 4. Branch Naming Convention

Tên branch sử dụng: tiếng Anh, lowercase, `kebab-case`, ngắn gọn nhưng mô tả đúng mục đích.

> Dự án cá nhân này không dùng Jira/ticket tracker, nên **không cần** gắn task ID vào tên nhánh — chỉ cần mô tả ngắn gọn nội dung thay đổi.

| Loại công việc    | Prefix     | Ví dụ                             |
| ----------------- | ---------- | --------------------------------- |
| Feature mới       | `feature/` | `feature/user-authentication`     |
| Bug fix           | `fix/`     | `fix/login-redirect-error`        |
| Maintenance       | `chore/`   | `chore/update-eslint-config`      |
| Documentation     | `..`       | `docs/update-readme`              |
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

Pull Request nên:

- Mô tả rõ thay đổi.
- Không còn unresolved conflict.
- Được review trước khi merge (khi có từ 2 người trở lên tham gia repo).
- Không chứa code/debug không cần thiết.
- Pass CI (workflow tại `.github/workflows/ci.yml`).

```text
Feature Branch → Push → Pull Request → Code Review → CI → Approve → Merge → dev
```

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

Không merge `dev` vào `main` nếu có lỗi rõ ràng hoặc review chưa xong. Khi CI đã được thiết lập (mục 14), không merge nếu CI fail. Production chỉ được deploy từ `main`.

---

## 9. Hotfix Workflow

> **Chỉ áp dụng khi dự án có môi trường production thật đang chạy.** Hiện tại đây là dự án học tập, chưa có production — mục này để sẵn cho tương lai.

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

Commit message ngắn gọn, mô tả đúng thay đổi. Khuyến nghị dùng Conventional Commits:

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

---

## 12. AI Tool Attribution

Commit message **không được** chứa attribution hoặc metadata của công cụ AI, ví dụ:

```text
Generated by Claude
Co-Authored-By: Claude
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
```

---

## 13. General Rules

- Không commit trực tiếp vào `main`, `dev`. Mọi thay đổi đi qua branch riêng và Pull Request.
- Không dùng `git push --force` trên `main`/`dev`.
- Không merge Pull Request nếu: conflict chưa resolve, review yêu cầu sửa, test/build fail.
- Không gom nhiều feature không liên quan vào cùng một branch (vd. tránh `feature/auth-and-dashboard-and-payment`, nên tách riêng từng branch).

---

## 14. CI & Branch Protection

Repo đã có CI workflow tại `.github/workflows/ci.yml`, chạy lint, typecheck, unit test, E2E, build và Docker build. Branch Protection cho `main`/`dev` vẫn cần cấu hình trên GitHub nếu chưa bật.

Khi thiết lập, khuyến nghị bật Branch Protection cho `main` và `dev`:

**`main`**: Require Pull Request, Require approval, Require CI checks, Block force push, Block direct push.

**`dev`**: Require Pull Request, Require CI checks, Block force push, Block direct push.

Nếu Branch Protection chưa được bật, các quy tắc review và CI pass vẫn mang tính tự giác dù workflow CI đã tồn tại.

---

## 15. Legacy `master` Branch

`master` là branch legacy, được giữ lại để tránh phá vỡ CI/CD pipeline cũ, external integration, link/automation cũ, và historical reference. **Không dùng `master` cho development mới.**

Branch trunk chính thức của repository là `main`. Default branch trên GitHub hiện vẫn là `master` — cân nhắc đổi sang `main` sau khi flow này đã chạy ổn định.

---

## 16. Complete Workflow Summary

| Branch      | Tạo từ            | Merge vào           | Mục đích                                            |
| ----------- | ----------------- | ------------------- | --------------------------------------------------- |
| `main`      | —                 | —                   | Production                                          |
| `dev`       | `main` (khởi tạo) | `main`              | Development integration                             |
| `feature/*` | `dev`             | `dev`               | Feature mới                                         |
| `fix/*`     | `dev`             | `dev`               | Bug trong development                               |
| `chore/*`   | `dev`             | `dev`               | Maintenance                                         |
| `docs/*`    | `dev`             | `dev`               | Documentation                                       |
| `hotfix/*`  | `main`            | `main` + sync `dev` | Production emergency fix (TODO — khi có production) |

```text
feature/* ─┐
fix/*     ─┼──────> dev ───────> main ───────> Production
chore/*   ─┤                       ▲
docs/*    ─┘                       │
                               hotfix/*
```

**Nguyên tắc cốt lõi:**

```text
main     = Production
dev      = Integration
feature/fix/chore/docs = Development
hotfix   = Emergency Production Fix (khi có production thật)

No Direct Push + Pull Request + Code Review + (CI khi có) = Safe Merge
```
