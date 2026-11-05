# Module `fulfillment`

> Trạng thái: **Đã chốt cho MVP**. Nguồn nghiệp vụ: [`../../business/04-business-rules.md`](../../business/04-business-rules.md) §6, [`../../business/05-order-lifecycle.md`](../../business/05-order-lifecycle.md) T10–T12, T14, §4.5, §4.7. Tích hợp: [`../06-integrations.md`](../06-integrations.md) §4. Bảng: [`../11-database.md`](../11-database.md).

## 1. Trách nhiệm

- Sở hữu: danh mục đơn vị hành chính 2 cấp, ánh xạ phường/xã sang GHN, Vận đơn, sự kiện vận chuyển thô.
- Tính phí ship (GHN thời gian thực, Phí ship dự phòng, miễn phí ship theo ngưỡng — BR-SHP-01..04).
- Tạo Vận đơn khi Staff bàn giao, nhận webhook và Đối soát trạng thái giao, phát hiện sự cố.
- Không sở hữu: trạng thái Đơn — báo cho `ordering` qua interface `ordering.onShipmentCreated/Delivered/ReturnedToSender` (T10–T12) và Cờ `shipment_exception`.
- `ordering.md` gọi module này là `shipping`; tên chuẩn là `fulfillment` ([`../02-modules.md`](../02-modules.md)).

## 2. Mô hình

Chi tiết cột, ràng buộc, enum: [`../11-database.md` §4.9](../11-database.md#49-fulfillment).

- `provinces`, `wards` — đơn vị hành chính 2 cấp
- `ghn_ward_mappings` — ánh xạ phường sang mã GHN
- `shipments` — Vận đơn GHN, một mỗi đơn
- `shipment_events` — inbox thô sự kiện GHN

## 3. Interface public

| Hàm | Gọi bởi | Ghi chú |
|---|---|---|
| `quoteShippingFee(address, weightGrams, subtotalAfterVoucher)` | `ordering` (Tính thử, đặt đơn) | Trả `{ fee, isFallback }`; GHN lỗi/timeout hoặc phường chưa ánh xạ → 35.000đ, `isFallback` để `ordering` gắn Cờ (BR-SHP-02) |
| `requestHandover(tx, orderId)` | `ordering` (Staff bàn giao) | Upsert `shipments` `REQUESTED`, ghi outbox `fulfillment.handover-requested` |
| `hasPendingCreation(orderId)` | `ordering` (guard T9) | `true` khi `REQUESTED`/`CREATION_UNKNOWN` (business/05 §4.5) |
| `cancelShipment(tx, orderId)` | `ordering` (T14, hoặc Vận đơn tạo xong cho đơn đã huỷ) | |

## 4. API

| Method | Path | Actor | Ghi chú |
|---|---|---|---|
| `GET` | `/provinces`, `/provinces/:code/wards` | public | Chọn địa chỉ ở checkout / sổ địa chỉ |
| `POST` | `/webhooks/ghn` | GHN | Xác minh token/IP, lưu `shipment_events`, trả `200` |
| `GET` | `/admin/shipments?orderId=` | staff | Trạng thái, lỗi cuối |
| `GET` | `/admin/ghn-ward-mappings?unmapped=true` | admin | Phường chưa ánh xạ + số đơn có Cờ `ghn_ward_unmapped` (US-1004 AC1) |
| `PUT` | `/admin/ghn-ward-mappings/:wardCode` | admin | Lưu ánh xạ (US-1004 AC2) |

## 5. Luồng

### 5.1. Bàn giao và tạo Vận đơn

```mermaid
sequenceDiagram
    actor S as Staff
    participant O as ordering
    participant F as fulfillment
    participant W as worker
    participant G as GHN

    S->>O: POST /admin/orders/:id/hand-over
    O->>F: requestHandover(tx) → shipments REQUESTED + outbox
    W->>F: consume fulfillment.handover-requested
    F->>G: create order (client_order_code = Mã đơn, COD = Tổng tiền)
    alt thành công
        F->>O: onShipmentCreated(ghn_order_code) → T10
    else lỗi xác định
        F->>F: CREATION_FAILED; Cờ shipment_creation_failed / ghn_ward_unmapped
    else timeout / không rõ
        F->>F: CREATION_UNKNOWN; Đối soát hỏi GHN theo Mã đơn
    end
```

Idempotency với GHN theo `client_order_code` = Mã đơn, nên bàn giao lại không tạo Vận đơn thứ hai (BR-SHP-05). Nếu GHN báo tạo xong khi đơn đã `CANCELLED`, `fulfillment` tự yêu cầu huỷ Vận đơn và gắn Cờ (business/05 §4.5).

### 5.2. Cập nhật trạng thái giao

Webhook và Đối soát cùng ghi vào `shipment_events` rồi đi chung một đường xử lý: ánh xạ `ghn_status` → T11 (`delivered`), T12 (`return`/`returned`), hoặc sự cố (mất, hư, GHN tự huỷ — BR-SHP-08) → `EXCEPTION` + Cờ `shipment_exception`, đơn giữ `SHIPPING`. Tới sớm → `DEFERRED`; trùng/đã qua → `IGNORED`; mâu thuẫn → `REJECTED` ([`../07-async-events-jobs.md`](../07-async-events-jobs.md) §1.3).

## 6. Sự kiện

Phát: `fulfillment.handover-requested`, `fulfillment.shipment-created`, `fulfillment.shipment-delivered`, `fulfillment.returned-to-sender`, `fulfillment.shipment-exception`.

Lắng nghe: `ordering.order-cancelled` — huỷ Vận đơn nếu đã tạo.

## 7. Job

| Job | Tần suất |
|---|---|
| Đối soát trạng thái Vận đơn (`CREATED`, `CREATION_UNKNOWN`) với GHN | Mỗi 15 phút **[Giả định · kiểm chứng hạn mức API GHN]** |
| Thử lại `shipment_events` `DEFERRED` | Mỗi phút |

## 8. Bao phủ nghiệp vụ

BR-SHP-01..08, BR-ORD-04, US-303, US-603, US-609 (phát hiện), US-1004; business/05 T10–T12, T14, §4.2, §4.5, §4.7.

## 9. Câu hỏi mở

- GHN có nhận địa chỉ 2 cấp trực tiếp không (quyết định giữ hay bỏ `ghn_ward_mappings`).
- Thời hạn lưu `creation_input` và `raw_payload` — chờ pháp chế/kế toán ([`../../business/06-compliance.md`](../../business/06-compliance.md) §5).
- Danh sách mã trạng thái GHN được coi là "sự cố".
