# Dùng hợp đồng API versioned theo URI

Mọi route HTTP công khai nằm dưới `/api/v1` (global prefix `api` + URI version `1`); Swagger ở `/docs`, tách khỏi prefix API. Storefront (web, sau này là mobile app — `business/01-vision-scope.md` §5.3) và back-office dùng chung một hợp đồng, nên một breaking change phải chạy song song `v1`/`v2` thay vì thay toàn bộ route cùng lúc.

Phương án bị loại: versioning qua header (khó thấy, khó cache, khó debug bằng trình duyệt) và không version (mobile app không ép cập nhật được thì mọi breaking change đều làm hỏng client cũ).
