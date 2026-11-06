# Guide 06: Gộp catalog thành một module

## Layout đích

```text
src/modules/catalog/
├── catalog.module.ts                 # file duy nhất ở gốc
├── controllers/
│   ├── storefront/                   # categories, products, product-options
│   └── back-office/                  # admin-categories, admin-products, admin-product-options
├── services/{categories,products,product-options}/
├── dto/{categories,products,product-options}/
├── domain/  mappers/  constants/  decorators/
```

Vì sao `controllers/` chứa 2 thư mục con: cấp đầu module đồng đều `controllers/ services/ dto/` kiểu NestJS, nhưng vẫn nhìn thư mục là biết route nào là `/admin/*` (cần guard Staff). Áp dụng cho mọi module — `coding-style §2.2`.

## Cách di chuyển an toàn

1. Chụp "trước": `find src -name '*.spec.ts' | wc -l`, `npm test`, `npm run test:e2e`, Swagger `curl localhost:$PORT/docs-json` (app chạy với `SWAGGER_ENABLED=true`).
2. Chỉ dùng `git mv` (giữ lịch sử, `git diff -M` hiện `R`).
3. Sửa import bằng sed trên chuỗi `#src/...` — **gồm cả chuỗi trong `vi.mock(...)`**, typecheck không bắt.
4. Grep đường dẫn cũ phải rỗng: `grep -rnE "catalog/(storefront|back-office)/" src test`.
5. `lint`, `typecheck`, `test`, `test:e2e` — không sửa assertion; số test bằng trước.
6. `diff <(jq -S . before.json) <(jq -S . after.json)` rỗng.

## Bẫy

- Không tạo barrel `index.ts` (ESM/DI load-order, coding-style §3).
- Thứ tự controller trong `catalog.module.ts` giữ nguyên để thứ tự route không đổi.
