# Report 14: Hợp đồng OpenAPI phát hành theo tag

Trạng thái: **done**, PR #80.

## Đã làm

- `scripts/write-openapi.ts` + `npm run openapi:write` (= `nest build` rồi `node scripts/write-openapi.ts`): dựng document từ `buildOpenApiDocument()` (tách ra từ `setupSwagger` trong `bootstrap/openapi.ts`), ghi `docs/openapi/openapi.json` với key sắp xếp. Không cần database: app chỉ được tạo, không `init()`, nên Prisma không kết nối; biến env bắt buộc được điền giá trị giả. Chạy trên `dist/` vì Nest DI cần `emitDecoratorMetadata` (tsx/esbuild không có).
- CI: job `openapi-contract` sinh lại file rồi `git diff --exit-code`.
- `.github/workflows/openapi-release.yml`: tag `openapi-v*` (hoặc `workflow_dispatch` với tag có sẵn) tạo GitHub Release đính kèm `docs/openapi/openapi.json`. Chưa tạo tag nào.
- `.prettierignore` bỏ qua file sinh ra.
- Controller catalog sang số ít (file đã đúng tên số ít).

## URL cho frontend

`OPENAPI_URL=https://github.com/<owner>/<repo>/releases/download/openapi-vX.Y.Z/openapi.json`

## operationId cũ → mới (32 dòng, chỉ phần tiền tố đổi, hậu tố `_<method>_v1` giữ nguyên)

- `ProductsController_*` → `ProductController_*` (findAll, findAllVariants, findOne, findOneVariant)
- `AdminProductsController_*` → `AdminProductController_*` (archive, archiveVariant, create, createImage, createVariant, findAll, findOne, removeImage, unarchive, unarchiveVariant, update, updateImage, updateVariant)
- `ProductOptionsController_*` → `ProductOptionController_*` (listColors, listSizes)
- `AdminProductOptionsController_*` → `AdminProductOptionController_*` (createColor, createSize, listColors, listSizes, updateColor, updateSize)
- `CategoriesController_*` → `CategoryController_*` (findOne, tree)
- `AdminCategoriesController_*` → `AdminCategoryController_*` (create, findAll, findOne, remove, update)

CMS `Api.generated.ts` khoá theo operationId nên phải sinh lại từ hợp đồng mới.

## Kết quả

Chạy `openapi:write` hai lần cho cùng md5. So Swagger trước/sau đổi tên: chỉ khác 32 dòng operationId.
