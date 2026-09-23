---
status: Implementing
owner: Backend
last_verified: 2026-09-23
dependencies: [02-categories.md]
supersedes:
  [
    docs/superpowers/specs/2026-09-18-products-and-variants-design.md,
    docs/superpowers/specs/2026-09-18-product-images-object-storage-design.md,
  ]
verification: [src/products, test/products.e2e-spec.ts, test/product-images.e2e-spec.ts]
---

# 03 — Products, Variants và Product Images

## Aggregate contract

Product là aggregate write boundary. Create/update nhận nested Variants; không cung cấp write endpoint variant độc lập. Update thực hiện full-sync danh sách Variant. Variant không còn bán chuyển sang `DISCONTINUED`; không hard-delete khi đã có commercial reference.

Read endpoints có thể expose Product và nested Variants theo OpenAPI runtime. Write yêu cầu `STORE_MANAGER` hoặc `MASTER_ADMIN`; catalog reads là public.

## Invariants

- Product slug và Variant SKU là unique.
- Mỗi Product phải thỏa validation của nested variant payload.
- Tạo Variant đồng thời bootstrap Inventory quantity/reserved quantity bằng `0`.
- Product/category reference phải tồn tại.
- Variant đang được Cart Item/Order Item tham chiếu không hard-delete.
- Create/update Product và toàn bộ Variant mutation phải atomic trong một database transaction.

## P0 gap

Runtime hiện cập nhật Product trước rồi đồng bộ Variants trong transaction khác. Nếu full-sync thất bại, Product fields có thể đã commit. Module chưa được coi là `Verified` cho aggregate update cho tới khi một transaction duy nhất bao trùm cả hai và có regression test rollback.

## Product Images contract

Flow hiện hành là presigned upload rồi attach metadata, không proxy file bytes qua API:

1. Client xin presigned target cho content type/size hợp lệ.
2. Client upload trực tiếp lên S3-compatible storage.
3. Client attach object key vào Product.
4. API list images, đặt primary và xóa metadata/object theo contract.

Chỉ object key thuộc prefix/bucket cho phép mới được attach. Mỗi Product tối đa một primary image; thao tác chuyển primary phải atomic. Local/unit test dùng fake adapter; external gate dùng MinIO/S3-compatible service.

## Acceptance criteria còn lại

- Regression test chứng minh update aggregate rollback toàn bộ khi một Variant invalid/conflict.
- Xác minh presign/attach lifecycle với MinIO hoặc provider thật.
- OpenAPI snapshot khớp nested aggregate và image endpoints.
