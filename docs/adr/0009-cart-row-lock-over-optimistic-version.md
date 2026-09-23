---
decision_status: accepted
implementation_status: planned
decided_at: 2026-09-17
last_verified: 2026-09-23
related_spec: ../specs/06-cart.md
---

# Dùng shared Cart row-lock protocol, không dùng optimistic version

Checkout và mọi CartItem mutation chạy đồng thời trên cùng Cart phải tuân theo một lock protocol: bắt đầu transaction, khóa cùng Cart row bằng `SELECT ... FOR UPDATE`, xác nhận Cart còn `ACTIVE`, rồi mới đọc/thay đổi Cart Items hoặc chuyển Cart sang `CHECKED_OUT`. Chỉ khóa ở Checkout là không đủ để serialize mutation trên child rows.

Không dùng `carts.version` kiểu optimistic locking: một Cart chỉ có một chủ sở hữu, tranh chấp hiếm và ngắn hạn, nên shared row lock đơn giản hơn check-and-increment trên mọi mutation. Chưa implement: schema có Cart/Cart Item nhưng chưa có module, checkout hay concurrency test.
