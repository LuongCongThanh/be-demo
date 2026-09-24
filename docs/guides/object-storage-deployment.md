<!-- Dành cho người triển khai hạ tầng. Contract nghiệp vụ: docs/specs/03-products.md; quyết định: docs/adr/0010. -->

# Object storage — triển khai lên AWS S3 / provider thật

Local dev: `minio-init` trong `docker-compose.yml` tự tạo bucket, lifecycle rule và quyền đọc. Trên provider thật phải cấu hình tay (IaC hoặc console):

- Lifecycle rule `tmp/` → expire 1 ngày (bắt buộc, ADR 0010).
- CORS bucket cho `POST` từ origin của FE — thiếu thì browser chặn bước upload dù presign đúng.
- Public read cho `products/*` — URL lưu DB là URL trực tiếp, không ký. S3 mặc định bật Block Public Access.
- Env: `S3_ENDPOINT=https://s3.<region>.amazonaws.com`, `S3_BUCKET`, `S3_REGION`, credential của IAM user có quyền trên bucket; `S3_PUBLIC_ENDPOINT` để trống nếu client và backend cùng endpoint.

Hạn chế hiện tại của adapter (việc cần làm trước khi production):

- `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` bắt buộc → chưa dùng được IAM role (ECS/EC2); cần cho phép bỏ trống để SDK dùng default credential chain.
- `forcePathStyle: true` hardcode → URL dạng `s3.<region>.amazonaws.com/<bucket>/<key>`; nên cấu hình được để dùng virtual-hosted style.
- Chưa hỗ trợ CDN: `publicUrl()` luôn là `<endpoint>/<bucket>/<key>` và `keyFromUrl()` cần `/<bucket>/` trong path — domain CloudFront (`cdn.example.com/<key>`) sẽ làm URL lưu DB sai và dọn object thất bại (chỉ log). Cần biến base URL công khai riêng nếu dùng CDN.
