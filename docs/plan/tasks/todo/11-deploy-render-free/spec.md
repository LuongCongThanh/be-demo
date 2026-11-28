---
status: todo
pr:
blocked-by: []
labels: []
---

# Spec 11: Deploy backend miễn phí (Render + Neon)

Branch dự kiến: `chore/deploy-render` · Plan: [plan.md](./plan.md)

## Problem Statement

API mới chỉ chạy local, FE deploy riêng chưa có backend công khai để gọi. Cần một URL HTTPS miễn phí cho demo.

## Phạm vi

- Image Docker tự chạy `prisma migrate deploy` khi khởi động.
- SameSite của cookie refresh token cấu hình được qua env, để FE khác site vẫn refresh/logout được.
- Deploy lên Render (free) với Postgres Neon (free); email Brevo tuỳ chọn.

Ngoài phạm vi: Redis/Upstash (code chưa dùng), custom domain, production thật.

## Acceptance Criteria

- [ ] `GET /api/v1/health/ready` trên URL Render trả 200.
- [ ] Đăng nhập admin và đọc catalog seed qua URL công khai.
- [ ] FE ở domain khác login → refresh → logout thành công.
- [ ] Không có secret nào trong repo hay PR.

Chi tiết các bước, biến môi trường, rủi ro và câu hỏi mở: [plan.md](./plan.md).
