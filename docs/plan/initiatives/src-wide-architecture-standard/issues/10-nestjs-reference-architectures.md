# Kiến trúc tham chiếu cho dự án NestJS

Type: docs/research
Status: resolved

## Question

Những kiến trúc nào được dùng phổ biến và có cơ sở cho dự án NestJS (layered mặc định Controller → Service → ORM; Clean/Hexagonal ports & adapters; DDD tactical + CQRS với `@nestjs/cqrs`; vertical slice / feature-based; modular monolith), và mỗi kiến trúc đánh đổi gì với bối cảnh của repo này: một người phát triển, NestJS + Prisma 7, modular monolith thương mại điện tử MVP, có kế hoạch transactional outbox (ADR-0003/0007), vitest, code phần lớn do AI agent viết nên chi phí token và độ dễ đọc quan trọng? Bộ khung thư mục đang đề xuất ở ticket 01 Q12 (`domain/`, `application/` + `ports/`, `infrastructure/`, `admin/`, `storefront/`, `<module>.module.ts`) khớp hoặc lệch với kiến trúc tham chiếu nào, và các repo/boilerplate NestJS có uy tín tổ chức thư mục ra sao?

## Answer

Chi tiết, bảng so sánh, cây ví dụ và nguồn: [docs/research/10-nestjs-reference-architectures.md](../research/10-nestjs-reference-architectures.md). Số file của từng kiến trúc là ước lượng, chưa đo.

- **Layered mặc định NestJS** (Controller → Service → Prisma): recipe Prisma chính thức inject `PrismaService` thẳng vào service, không có repository. Rẻ nhất, nhưng service dễ phình (checkout 537 dòng).
- **Clean/Hexagonal**: khớp với quyết định "một kiến trúc, DB qua Port". Các nguồn (Cockburn, Sairyss) coi nó là khuyến nghị, cho rằng không hợp CRUD đơn giản và port cho DB "không phải lúc nào cũng có ích". "Không ngoại lệ" chặt hơn mọi nguồn đã khảo sát.
- **DDD + CQRS (`@nestjs/cqrs`)**: nhiều file nhất; event bus và saga chạy trong bộ nhớ nên không thay được transactional outbox (ADR-0003/0007).
- **Vertical slice**: rẻ, ngữ cảnh gọn cho agent, nhưng logic dùng chung (giá, voucher, tồn kho) không có chỗ rõ ràng.
- **Modular monolith**: nói về ranh giới giữa module, không về bố cục bên trong. Grzybek cấm transaction xuyên module, mâu thuẫn với `$transaction` hiện tại của checkout (đơn + tồn + voucher).
- **Prisma**: Prisma Client tự là Data Mapper; không nguồn chính thức nào bắt buộc repository bọc nó. `tx` là Prisma Client nên không truyền qua Port mà không lộ kiểu Prisma. Có 4 cách xử lý transaction (method atomic trong Port, TransactionPort + AsyncLocalStorage, ví dụ `nestjs-cls` có adapter Prisma, truyền `tx`, hoặc service gọi Prisma thẳng). Interactive transaction mặc định `maxWait` 2000 ms, `timeout` 5000 ms.
- **brocoders/nestjs-boilerplate**: một repository port mỗi feature (abstract class làm token), bố cục `domain/`, `dto/`, `infrastructure/persistence/{document,relational}`, không có `application/` và không tách admin/storefront. Khả năng cao là nguồn gốc tên `infrastructure/persistence/relational` của Category (suy luận, chưa có tài liệu xác nhận).
- **Bộ khung Q12**: `domain/`, `application/` + `ports/`, `infrastructure/` khớp Hexagonal. Cách đặt thư mục tầng ở gốc rồi lặp `admin/`, `storefront/` có `application/` riêng bên trong là dạng lai, không tham chiếu nào dùng; hệ quả trong Category là `application/` bị nhân đôi, có 2 `category-response.mapper.ts` và thêm `application/shared/`.
- **Ba phương án giữ "một kiến trúc"**: A = Q12 nguyên trạng (Category không đổi; cart khoảng 8-9 file, lồng 3-4 cấp). B = hexagonal-lite kiểu brocoders (cart khoảng 7 file, lồng 2 cấp; bỏ thư mục bề mặt nên đụng quyết định Q5; Category phải đổi nhiều). C = mỗi use case một file + Port + unit of work (file nhỏ; quy ước mới; Category phải đổi nhiều).
