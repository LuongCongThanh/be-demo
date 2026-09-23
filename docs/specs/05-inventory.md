---
status: Draft
owner: Backend
last_verified: 2026-09-23
dependencies: [03-products.md]
---

# 05 — Inventory specification

Inventory sở hữu số lượng của một Product Variant trong single-warehouse MVP. Products chỉ bootstrap row quantity/reserved quantity `0`; mọi mutation sau thuộc Inventory.

## Scope

- Staff đọc và điều chỉnh quantity với reason/audit.
- Checkout tạo Reservation 15 phút.
- Reservation chuyển từ `ACTIVE` sang đúng một trạng thái `CONSUMED`, `RELEASED` hoặc `EXPIRED`.
- Worker xử lý expiry/recovery; event quan trọng đi qua transactional outbox.

## Invariants

- Không oversell; available quantity không âm.
- Lock nhiều Variant theo thứ tự ổn định để hạn chế deadlock.
- Adjustment và audit cùng transaction.
- Reservation transition idempotent; expiry không được release hai lần.

## Implementation order

Chốt schema Reservation/Outbox → migration → adjustment API → transactional reservation service → expiry worker → concurrency/recovery tests. Trước implementation phải chốt exact lock query, retention/replay và downstream dedup keys.
