# 06. Tích hợp bên ngoài

> Trạng thái: **Đã chốt cho MVP**. Nguồn nghiệp vụ: [business/04](../business/04-business-rules.md) §6–8, [business/05](../business/05-order-lifecycle.md). Quyết định: [ADR 0004](../adr/0004-payment-gateways-vnpay-momo-cod.md).

## 1. Nguyên tắc chung

- Mỗi bên ngoài là một **adapter** sau một interface trong module sở hữu; domain không import SDK của nhà cung cấp.
- Gọi ra ngoài **không** nằm trong transaction DB. Kết quả ghi lại bằng transaction riêng; việc gọi chạy qua outbox/worker khi không cần trả lời đồng bộ ([07-async-events-jobs.md](./07-async-events-jobs.md)).
- Mọi call có timeout, retry có backoff cho lỗi tạm thời, và idempotency key khi nhà cung cấp hỗ trợ.
- Callback/webhook: xác minh chữ ký → lưu bản ghi sự kiện thô (khử trùng theo mã giao dịch của nhà cung cấp) → trả `200` nhanh → xử lý.
- Sandbox của từng nhà cung cấp dùng cho môi trường dev/staging; go-live cần nghiệm thu sandbox.

| Nhà cung cấp                | Dùng cho                           | Module sở hữu   |
| --------------------------- | ---------------------------------- | --------------- |
| VNPay, MoMo                 | Thanh toán online                  | `payments`      |
| GHN                         | Phí ship, Vận đơn, trạng thái giao | `fulfillment`   |
| Email provider (SMTP/API)   | Email giao dịch                    | `notifications` |
| Object storage (Cloudinary) | Ảnh Sản phẩm                       | `catalog`       |
| Google OAuth                | Đăng nhập Google                   | `identity`      |

## 2. Thanh toán: VNPay và MoMo

### 2.1. Interface

```ts
interface PaymentGateway {
  createPaymentLink(input: {
    paymentId;
    amount;
    orderCode;
    expiresAt;
    returnUrl;
    locale;
  }): Promise<{ url; providerRef }>;
  verifyCallback(raw: RawCallback): VerifiedCallback; // ném lỗi nếu sai chữ ký
  query(providerRef: string): Promise<GatewayStatus>; // cho Đối soát
}
```

Mỗi lần Người mua bấm trả tiền tạo một bản ghi `payments` mới với `gateway = VNPAY | MOMO`; đơn còn chờ thanh toán thì được thử lại bằng Cổng khác (BR-PAY-01). Số tiền là số nguyên VND.

### 2.2. Thời hạn

- Link hết hạn ở **phút 10** kể từ khi đặt đơn (truyền `expiresAt` tuyệt đối, không phải thời lượng); từ **phút 7** không tạo link mới (BR-INV-05).
- Giữ hàng hết hạn ở phút 15 — 5 phút đệm để nhận IPN đến muộn ([ADR 0003](../adr/0003-inventory-reservations-and-transactional-outbox.md)).

### 2.3. Xác nhận thanh toán

- Chỉ **IPN** (server-to-server, đã xác minh chữ ký) hoặc **Đối soát** mới đổi trạng thái; Return URL chỉ hiển thị "đang xác nhận" (BR-PAY-02).
- IPN trùng chỉ xử lý một lần: UK `payment_notifications(gateway, dedup_key)` (BR-PAY-03).
- Chỉ trạng thái **captured** mới là bằng chứng thu tiền. Số tiền captured khác Tổng tiền đơn → không xác nhận đơn, gắn Cờ, tự tạo yêu cầu Hoàn tiền (BR-PAY-04).
- Tiền về cho đơn không còn chờ thanh toán → tự tạo yêu cầu Hoàn tiền, gắn Cờ, đơn giữ nguyên (BR-PAY-05, [ADR 0006](../adr/0006-manual-refund-mvp-scope.md)).
- Trả lời IPN theo đúng định dạng mỗi Cổng yêu cầu để Cổng ngừng gửi lại.

### 2.4. Đối soát

Job **mỗi 5 phút** truy vấn `query()` cho các `payments` còn treo (đã tạo link, chưa có kết quả cuối) — xử lý trường hợp IPN bị mất. Kết quả đi qua cùng một đường xử lý với IPN, nên khử trùng như nhau.

### 2.5. COD

Không qua Cổng. Đặt đơn COD tạo khoản thu COD chờ thu; GHN báo giao thành công thì ghi nhận đã thu (T11). Hạn mức COD mặc định 5.000.000đ, Admin cấu hình (BR-PAY-06). Đối chiếu tiền GHN chuyển về nằm ngoài MVP (BR-REF-04).

### 2.6. Hoàn tiền

MVP không gọi API hoàn tiền: Staff hoàn trên trang quản trị của Cổng rồi ghi nhận mã giao dịch hoàn (BR-REF-03). Interface để sẵn chỗ cho `refund()` ở Giai đoạn 2.

## 3. Email

- Adapter `MailSender` (SMTP/API); gửi qua worker, không gửi trong request.
- Template theo ngôn ngữ Khách hàng chọn (vi/en); tên Sản phẩm luôn tiếng Việt (BR-NTF-02). Khách vãng lai không có email thì không gửi (BR-NTF-03).
- Mỗi lần gửi ghi `email_logs` (`sent`/`failed`/`cancelled`); thời hạn lưu theo [business/06 §5](../business/06-compliance.md) — xem [07-async-events-jobs.md](./07-async-events-jobs.md) §3.2.

## 4. Vận chuyển: GHN

### 4.1. Các API dùng

| Việc                | Khi nào             | Quy tắc                                                                                                                                                                                                                                                                                                                |
| ------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tính phí ship       | Tính thử và đặt đơn | Theo địa chỉ giao + tổng cân nặng; kích thước gói mặc định cấu hình được (BR-SHP-01). GHN lỗi/timeout → **Phí ship dự phòng** 35.000đ và gắn Cờ "phí ship dự phòng" (BR-SHP-02). Miễn phí ship khi Tạm tính sau Voucher ≥ ngưỡng 500.000đ (BR-SHP-03/04)                                                               |
| Tạo Vận đơn         | Staff bàn giao      | Chạy nền qua outbox. Timeout/không rõ kết quả → Vận đơn `creation_unknown`, Đối soát chốt (không coi là thất bại, business/05 §4.5). Thành công → `SHIPPING` (T10); thất bại → giữ `PACKING` + Cờ. Bàn giao lại **dùng lại** Vận đơn đó — idempotency theo Mã đơn (BR-SHP-05). COD: thu hộ = tổng tiền đơn (BR-SHP-07) |
| Webhook trạng thái  | GHN đẩy             | Xác minh nguồn (token/IP whitelist theo GHN), lưu sự kiện thô, ánh xạ sang T11/T12 hoặc Cờ sự cố (BR-SHP-06, BR-SHP-08)                                                                                                                                                                                                |
| Đối soát trạng thái | Mỗi **15 phút**     | Bù webhook bị mất. Tần suất là giả định, kiểm chứng hạn mức API GHN khi nghiệm thu sandbox ([business/05 §5](../business/05-order-lifecycle.md))                                                                                                                                                                       |

Sự kiện đến sai thứ tự (ví dụ "đã giao" trước khi ghi nhận Vận đơn tạo xong) được giữ lại và áp dụng lại sau — [07-async-events-jobs.md](./07-async-events-jobs.md) §1.3.

### 4.2. Địa chỉ 2 cấp và ánh xạ sang GHN

- Địa chỉ giao hàng theo **2 cấp: tỉnh/thành phố và phường/xã**, theo sắp xếp đơn vị hành chính từ 07/2025, kèm địa chỉ chi tiết (BR-ORD-04). Hệ thống lưu danh mục đơn vị hành chính của riêng mình.
- Nếu API GHN vẫn cần mã tỉnh–quận–phường cũ, hệ thống giữ một bảng **ánh xạ phường/xã → (GHN province_id, district_id, ward_code)**.
- Phường/xã chưa có ánh xạ: tính phí dùng Phí ship dự phòng; tạo Vận đơn không được → đơn gắn Cờ `shipment_creation_failed` (`details` ghi phường chưa ánh xạ). Admin bổ sung ánh xạ trên back-office, rồi Staff bàn giao lại và gỡ cờ (US-1004).
- Nếu khi nghiệm thu sandbox GHN đã nhận địa chỉ 2 cấp trực tiếp thì bỏ bảng ánh xạ và US-1004 (US-1004 AC3).

## 5. Object storage cho ảnh Sản phẩm

- Ảnh gắn theo **màu** của Sản phẩm (BR-CAT-05).
- Kho ảnh hiện là **Cloudinary** (adapter `infrastructure/storage/cloudinary.client.ts`, biến `CLOUDINARY_*`). Thiếu biến thì upload/gắn ảnh trả 503 và ảnh không có `url`.
- Upload hai bước, API không truyền byte ảnh:
  1. Back-office gọi `POST /admin/products/:id/images/presign` (Quyền `CATALOG_PRODUCT_MANAGE`), nhận `uploadUrl`, `fields` đã ký và `storageKey` (`products/{productId}/{uuid}`).
  2. Trình duyệt gửi form POST gồm `fields` và file (`file`) thẳng tới `uploadUrl`.
  3. Back-office gọi `POST /admin/products/:id/images` với `storageKey` và `colorId`. API kiểm key đúng tiền tố của Sản phẩm, hỏi kho file có tồn tại, định dạng JPEG/PNG/WebP và không quá 5 MB; sai thì xoá file và trả 422.
- Chữ ký có `overwrite=false`: không ghi đè được ảnh đã kiểm. Cloudinary nhận chữ ký trong 1 giờ (`expiresAt`), API không rút ngắn được.
- Ảnh đọc công khai qua CDN của kho; chỉ ghi qua chữ ký do API cấp. API trả `url` dựng từ `storageKey`, DB chỉ lưu key.
- Xoá ảnh: xoá bản ghi trước, rồi xoá file (best-effort, lỗi chỉ log). File đã upload mà không gắn vào Sản phẩm nằm lại trong kho, dọn sau.
- Đổi sang kho chuẩn S3 (R2 khi chạy thật, MinIO trong docker khi dev, presigned POST) chỉ thay adapter: response `uploadUrl + fields` cùng dạng.

## 6. Google OAuth

- Authorization Code + PKCE; server đổi code lấy ID token, xác minh `aud`, `iss`, chữ ký và `email_verified`.
- Liên kết theo email theo US-502; email thuộc Tài khoản nội bộ bị từ chối (US-502 AC4).
- Đăng nhập Google được tính là xác thực email (kích hoạt gắn đơn BR-ORD-08). Chi tiết: [05-auth-security.md](./05-auth-security.md) §2.
