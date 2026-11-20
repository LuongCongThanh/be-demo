# Report 13: `catalog/` theo layout phẳng

Trạng thái: **done**, PR #75.

## Bố cục hiện hành

PR #97 chủ ý supersede bố cục phẳng của ticket này: các entity `product/`, `category/`, `product-option/` và `pricing/` tiếp tục nằm trong Catalog, còn controller/service/DTO được nhóm theo audience/use case. Spec và kết quả PR #75 bên dưới ghi lại trạng thái khi ticket được hoàn thành; cấu trúc mới là quyết định tiếp nối, không phải thay đổi hồi tố acceptance criteria cũ.

## Đã làm

- `catalog/` → `product/`, `category/`, `product-option/` (controller, service, dto, mapper, constants, decorator, spec theo tên số ít); `variant-include.constant.ts` gộp vào `product/product.constants.ts`.
- `bootstrap/setup-swagger(.spec).ts` → `bootstrap/openapi(.spec).ts`; `common/utils/prisma-error.util.ts` → `infrastructure/database/`.
- Class service đổi số ít (`ProductsService` → `ProductService`...); import và docs convention cập nhật; thư mục cũ đã xoá.

## Kết quả

`typecheck`, `lint`, `build` xanh; unit 240/240; Swagger `jq -S` diff trước/sau rỗng; grep đường dẫn cũ ngoài task docs: 0 kết quả. E2E không chạy (không có DB local).

## Quyết định lệch ticket

- Giữ nguyên tên class controller: operationId Swagger là `<Controller>_<method>` và `cms/.../Api.generated.ts` khoá theo operationId; đổi tên làm diff Swagger khác rỗng (đã thử, 32 dòng operationId đổi).
- Branch `chore/catalog-subfolders` thay vì `refactor/...` vì hook pre-push chưa cho `refactor/`.
