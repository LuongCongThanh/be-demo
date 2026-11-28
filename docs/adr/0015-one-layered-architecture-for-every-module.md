# Một kiến trúc nhiều tầng cho mọi module

Mọi module trong `src/modules` dùng chung một kiến trúc Hexagonal, không có ngoại lệ cho module nhỏ. Domain thuần; service ở `application/` gọi Port; mọi truy cập DB đi qua Persistence Port với adapter Prisma ở `infrastructure/`. Thư mục bề mặt `admin/` (Back-office) và `storefront/` chỉ chứa phần giao tiếp HTTP: controllers, dto, mappers. Thư mục chỉ tạo khi có file thật. Lý do: một bố cục duy nhất thì người và AI agent đều biết file nằm ở đâu ngay trong mọi module, và ranh giới tầng được chặn bằng lint thay vì phải xét từng module. Cái giá chấp nhận được là module CRUD nhỏ như `cart` sẽ nhiều file hơn.

Quyết định này thay thế quyết định "không sao chép cấu trúc Category sang module khác" (ticket 01 của map `feature-module-boundaries`) và hướng dẫn "CRUD đơn giản gọi Prisma thẳng từ service" (`docs/conventions/api-rules.md` R3).

## Considered Options

- **Hai mức** (gọi Prisma thẳng mặc định, chỉ module phức tạp dùng Hexagonal): khớp khuyến nghị của các nguồn tham chiếu và rẻ hơn. Bị loại vì mỗi module một kiểu làm cấu trúc khó đoán và phải duy trì tiêu chí phân mức.
- **Bộ khung Category v1.6 nguyên trạng** (mỗi thư mục bề mặt có `application/` riêng): bị loại vì đây là dạng lai không tham chiếu nào dùng, và gây nhân đôi `application/` và mapper.
- **Kiểu brocoders** (bỏ thư mục bề mặt) và **mỗi use case một file**: bị loại vì phải đổi Category nhiều và đưa vào quy ước mới.

Khảo sát chi tiết: `docs/plan/initiatives/src-wide-architecture-standard/research/10-nestjs-reference-architectures.md`.
