# 05. Xác thực, phân quyền và bảo mật

> Trạng thái: **Đã chốt cho MVP**. Nguồn nghiệp vụ: [business/02](../business/02-actors-permissions.md), [business/03](../business/03-user-stories.md) E5, [business/06](../business/06-compliance.md). Quyết định: [ADR 0005](../adr/0005-four-actor-authorization-model.md), [ADR 0011](../adr/0011-guest-identity-by-order-code-and-phone.md).

## 1. Các lớp bảo mật

```text
Internet → CDN/WAF → Load balancer (TLS) → Rate limiting → Xác thực → Phân quyền
        → Validate input (DTO) → Business logic → PostgreSQL
```

Control bắt buộc: HTTPS, hash mật khẩu (argon2/bcrypt), access token ngắn hạn, refresh token xoay vòng có thể thu hồi, validate input, CORS theo whitelist, cookie `HttpOnly; Secure; SameSite`, query tham số hoá (Prisma), chữ ký webhook, audit log, secret ngoài source code.

## 2. Xác thực Khách hàng

| Luồng                            | Quy tắc                                                                                                                                                                                                                         | Nguồn                 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Đăng ký email + mật khẩu         | Bắt buộc tick đồng ý dữ liệu (không tick sẵn). Mọi request hợp lệ về định dạng trả **cùng một phản hồi**, không lộ email đã tồn tại; email đã có Tài khoản đã xác thực hoặc Tài khoản nội bộ thì gửi thư cảnh báo cho chủ email | US-501, CMP-01/02     |
| Xác thực email                   | Token một lần, lưu dạng hash. Xác thực xong thì gắn các đơn vãng lai cùng email (không phân biệt hoa thường)                                                                                                                    | US-501 AC3, BR-ORD-08 |
| Đăng nhập Google                 | Email mới → tạo Tài khoản (email coi như đã xác thực). Email đã có Tài khoản → liên kết; nếu Tài khoản đó chưa xác thực thì **xoá mật khẩu cũ và thu hồi mọi phiên**                                                            | US-502 AC1–2          |
| Đăng nhập sai                    | Sai nhiều lần liên tiếp thì tạm khoá đăng nhập theo tài khoản                                                                                                                                                                   | US-502 AC3            |
| Quên mật khẩu                    | Luôn trả "Nếu email tồn tại…". Link dùng một lần, hết hạn **1 giờ**. Đặt lại thành công thì thu hồi mọi phiên                                                                                                                   | US-503                |
| Tài khoản nội bộ trên storefront | Bị từ chối, kể cả qua Google, với thông báo lỗi chung; email/mật khẩu: storefront từ chối theo `role` trả về, server chặn thao tác mua hàng bằng `@Roles` (ADR 0005); Google: server từ chối                                    | US-502 AC4            |

**Token:** access token JWT ngắn hạn (khoảng 15 phút); refresh token ngẫu nhiên, chỉ lưu hash, xoay vòng mỗi lần dùng; dùng lại một refresh token đã xoay thì thu hồi cả chuỗi (phát hiện token bị lộ). Mỗi thiết bị một phiên.

## 3. Vai trò và phân quyền

Bốn vai trò `GUEST`, `CUSTOMER`, `STAFF`, `ADMIN` (ADR 0005). Tài khoản nội bộ có đúng một vai trò `STAFF` hoặc `ADMIN`; `ADMIN` có mọi quyền của `STAFF`. Tài khoản Admin chỉ tạo bằng CLI `npm run cli -- create-admin` (entrypoint riêng `src/cli.ts`, nest-commander, không mở qua HTTP — xem [modules/identity.md](./modules/identity.md) §5.4); trên back-office Admin chỉ quản lý Tài khoản Staff.

- Mỗi route khai báo **tường minh** danh sách vai trò được phép (`@Authorize('STAFF', 'ADMIN')`, `src/common/auth/`); không có cây phân cấp ẩn.
- Guard thứ tự: `AuthGuard` (401) → `RolesGuard` (403) → kiểm tra sở hữu tài nguyên trong service (đơn của chính mình).
- Ma trận quyền chi tiết: [business/02 §3](../business/02-actors-permissions.md).

## 4. Phiên truy cập đơn của Khách vãng lai

Theo ADR 0011:

- Giỏ vãng lai gắn cookie ngẫu nhiên (chỉ lưu hash ở server), hết hạn sau 30 ngày không hoạt động.
- Đặt đơn xong, server cấp một **phiên truy cập đơn** 30 phút gắn với đúng Mã đơn đó (cookie `HttpOnly`).
- Tra cứu bằng **Mã đơn + số điện thoại** khớp nhau cấp một phiên mới 30 phút. Sai bất kỳ trường nào → "Không tìm thấy đơn", không phân biệt nguyên nhân (US-401 AC2).
- Phiên vãng lai chỉ cho phép xem, thanh toán và huỷ đúng đơn đó.

## 5. Vô hiệu hoá Staff và thu hồi phiên

Vô hiệu hoá Tài khoản Staff, đổi mật khẩu, hoặc liên kết Google thu hồi mật khẩu đều làm **mọi phiên mất hiệu lực ngay** ([business/02 §4](../business/02-actors-permissions.md)):

- Mỗi User có `session_version`; access token mang version lúc cấp.
- Request có xác thực so version trong token với giá trị hiện tại (cache ngắn trong Redis, nguồn là PostgreSQL). Lệch → 401.
- Với route back-office, không xác minh được version (Redis và DB lỗi) thì **fail closed**.
- Đồng thời thu hồi toàn bộ refresh token của User.

## 6. Audit log

- Mọi thao tác **ghi** trên back-office lưu: người làm, thời điểm, đối tượng, giá trị trước và sau ([business/02 §4](../business/02-actors-permissions.md)).
- Mọi lượt Staff **xem** dữ liệu cá nhân Người mua (chi tiết Khách hàng, chi tiết Đơn, tìm đơn theo SĐT) được ghi; mở danh sách đơn thì không (CMP-07).
- Audit ghi trong cùng transaction với thay đổi nghiệp vụ; bảng chỉ thêm, không sửa/xoá qua ứng dụng.

## 7. Rate limiting, webhook, secret, dữ liệu cá nhân

**Rate limiting** (Redis, fail closed `503` khi Redis lỗi — [ADR 0008](../adr/0008-redis-outage-degrades-not-unready.md)):

| Endpoint                                 | Khoá giới hạn                         |
| ---------------------------------------- | ------------------------------------- |
| Đăng nhập                                | IP + email                            |
| Đăng ký, quên mật khẩu, gửi lại xác thực | IP + email                            |
| Tra cứu đơn vãng lai                     | **IP** — chống dò mã đơn (US-401 AC3) |
| Tính thử, đặt đơn                        | IP + giỏ                              |

Webhook (VNPay, MoMo, GHN) **không** bị rate limit chung và không cần Redis.

**Webhook:** xác minh chữ ký/HMAC của từng Cổng trước khi đọc nội dung; sai chữ ký → từ chối và ghi cảnh báo. Không bao giờ tin Return URL (BR-PAY-02). Chi tiết: [06-integrations.md](./06-integrations.md).

**Secret:** chỉ đọc qua biến môi trường được validate lúc khởi động; production lấy từ secret manager; không commit `.env`. Khoá webhook, khoá JWT, khoá HMAC log tách riêng và xoay vòng được.

**Dữ liệu cá nhân** ([business/06](../business/06-compliance.md)): không lưu thông tin thẻ/ví; lưu bằng chứng đồng ý (CMP-02); Yêu cầu xoá dữ liệu **ẩn danh** tên, SĐT, email, địa chỉ nhưng giữ dữ liệu kế toán (CMP-05), chạy như job nhiều bước có trạng thái `processing → completed`.

## 8. Logging và dữ liệu cá nhân

- Log có cấu trúc (JSON), kèm `requestId`. Chi tiết logger: [08-observability.md](./08-observability.md).
- **Che PII** trước khi ghi: email, số điện thoại, tên, địa chỉ, token, mật khẩu, header `Authorization`/`Cookie` và payload webhook thanh toán bị mask hoặc loại bỏ bằng một danh sách field tập trung.
- **IP chỉ ghi dạng HMAC** (khoá bí mật riêng) — vẫn so khớp được để điều tra gian lận/rate limit, nhưng không đọc ngược ra IP.
- Log ứng dụng **tự xoá sau 30 ngày** ([business/06 §5](../business/06-compliance.md)). Audit log và bằng chứng đồng ý không phải log ứng dụng và theo thời hạn lưu riêng.
- Chỉ log lỗi 5xx ở mức `error`; lỗi 4xx không log (theo convention error handling).
