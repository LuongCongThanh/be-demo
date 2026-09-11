# Git Workflow

Quy ước nhánh (branching strategy) áp dụng cho repo này.

## Sơ đồ nhánh

```
main                (nhánh production, ổn định)
 └── dev            (nhánh tích hợp, checkout từ main)
      └── feature/* (nhánh tính năng, checkout từ dev)
      └── fix/*      (nhánh sửa lỗi, checkout từ dev)
      └── chore/*    (nhánh việc vặt/dọn dẹp, checkout từ dev)
```

- **`main`**: nhánh gốc, luôn ở trạng thái ổn định, sẵn sàng release.
- **`dev`**: nhánh tích hợp các tính năng đang phát triển. Checkout ra từ `main`.
- **Nhánh tính năng** (`feature/<ten-tinh-nang>`, `fix/<ten-loi>`, `chore/<viec>`): checkout ra từ `dev`, làm việc trên đó rồi merge ngược lại `dev` qua Pull Request.

## Luồng làm việc

1. Cập nhật `dev` mới nhất:
   ```bash
   git checkout dev
   git pull origin dev
   ```
2. Tạo nhánh tính năng từ `dev`:
   ```bash
   git checkout -b feature/ten-tinh-nang dev
   ```
3. Code, commit, push nhánh tính năng, mở Pull Request **vào `dev`**.
4. Sau khi review xong, merge Pull Request vào `dev`.
5. Khi `dev` đã ổn định và sẵn sàng release, mở Pull Request **từ `dev` vào `main`** để merge.

## Quy ước đặt tên nhánh

| Loại việc      | Tiền tố       | Ví dụ                         |
| -------------- | ------------- | ------------------------------ |
| Tính năng mới  | `feature/`    | `feature/user-authentication`  |
| Sửa lỗi        | `fix/`        | `fix/todo-null-pointer`        |
| Việc vặt/dọn dẹp | `chore/`    | `chore/remove-todo-module`     |
| Tài liệu       | `docs/`       | `docs/update-readme`           |

## Quy tắc chung

- Không commit trực tiếp lên `main`. Mọi thay đổi vào `main` đều phải đi qua `dev` bằng Pull Request.
- Không commit trực tiếp lên `dev` cho các thay đổi lớn — ưu tiên tạo nhánh tính năng riêng rồi merge qua Pull Request để dễ review.
- `master` là nhánh lịch sử/legacy, được giữ lại song song với `main` để không phá vỡ các liên kết/CI cũ đang trỏ vào `master`. Từ nay, `main` là nhánh trunk chính thức để phát triển theo flow ở trên.
- Commit message không thêm tên công cụ AI (ví dụ "Claude", "Co-Authored-By: Claude") — chỉ ghi tác giả là người thực hiện.
