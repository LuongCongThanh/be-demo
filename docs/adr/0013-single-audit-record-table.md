---
decision_status: accepted
implementation_status: planned
decided_at: 2026-09-25
last_verified: 2026-09-25
related_spec: ../specs/04-users.md
---

# Mọi Audit Record ghi vào một bảng `audit_logs` chung, trong cùng transaction với thay đổi

Bối cảnh: Module 04 Users yêu cầu mỗi thay đổi đặc quyền (Account Status, Role) để lại Audit Record gồm actor, target, action, before/after, request id và timestamp, ghi **cùng transaction** với mutation. Các module sau (Inventory adjustment ở 05, Refund ở 08) cũng cần vết tương tự. Có ba phương án:

- (A) Một bảng `audit_logs` chung: `actor_user_id`, `action`, `target_type`, `target_id`, `before`/`after` dạng JSONB, `request_id`, `created_at`. Mỗi module ghi vào cùng bảng trong transaction của mình.
- (B) Mỗi loại thay đổi một bảng riêng (`user_role_changes`, `user_status_changes`, …): cột chặt chẽ, DB ràng buộc được cấu trúc, nhưng mỗi module phải lặp lại bảng, migration và code ghi.
- (C) Chỉ ghi structured log: không nằm trong transaction, có thể mất hoặc bị xoay vòng — không đạt yêu cầu "tồn tại khi và chỉ khi thay đổi xảy ra".

Chọn (A): một chỗ ghi, một cách truy vấn cho mọi thay đổi đặc quyền, module mới chỉ thêm giá trị `action`/`target_type`. Đánh đổi: cấu trúc `before`/`after` không được DB kiểm tra — mỗi `action` phải có shape cố định do code ghi đảm bảo (và test). Bảng là append-only: code ứng dụng không update/delete dòng audit. Không ghi secret, token hay password hash vào `before`/`after`.

Hệ quả: đổi sang (B) sau này đòi hỏi tách dữ liệu JSONB đang có ra nhiều bảng. Bảng sẽ lớn dần theo thời gian; index tối thiểu theo `(target_type, target_id, created_at)` và `actor_user_id`. Retention/partitioning chỉ cân nhắc khi đo được kích thước thực tế.
