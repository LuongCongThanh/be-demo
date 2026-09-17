# Dùng hợp đồng API versioned theo URI

Hợp đồng HTTP công khai sẽ dùng global prefix `api` và Nest URI version `1`, tạo ra các route dưới dạng `/api/v1`. Việc versioning được đưa vào trước khi các module thương mại được triển khai để những thay đổi phá vỡ tương thích (breaking change) sau này có thể tồn tại song song thay vì phải thay thế toàn bộ route cùng lúc; các route `/auth/*` chưa versioned hiện tại sẽ được migrate thay vì giữ lại như alias vĩnh viễn. Swagger sẽ chuyển sang `/docs` để tài liệu không bị nhầm lẫn với API prefix.
