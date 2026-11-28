# Đánh giá hạ tầng pilot/scale theo tải 500–5.000 đơn/ngày

> Ticket: `07-pilot-hosting-capacity.md` — `/home/thanhluongcong/Documents/fashion-store/be-demo/docs/plan/wayfinding/fashion-store-mvp-implementation/issues/07-pilot-hosting-capacity.md`
> Ngày truy cập tài liệu nhà cung cấp: **2026-11-21**
> Phạm vi: đối chiếu giới hạn và giá công khai hiện hành của Render/Neon, đề xuất các cấu hình để kiểm chứng tải. Giá tính bằng USD, chưa gồm thuế, egress vượt mức, dịch vụ ngoài phạm vi và chi phí nhân lực vận hành.

## Tóm tắt quyết định

- **Task 11 chỉ là demo miễn phí**, không phải production. Spec ghi rõ ngoài phạm vi “production thật”; Render Free có thể ngủ/restart, không scale ngang, còn Render Free Postgres hết hạn sau 30 ngày và không hỗ trợ backup hay managed connection pool. Neon Free giới hạn 100 CU-hours và 1 GB Postgres/project, bắt buộc scale-to-zero. Không dùng các gói Free để cam kết pilot thương mại hay SLA. [Task 11 spec](../plan/tasks/todo/11-deploy-render-free/spec.md); [Render Free](https://render.com/docs/free); [Neon plans](https://neon.com/docs/introduction/plans).
- Với **500 đơn/ngày**, một lựa chọn pilot có trả phí, tiết kiệm và dễ nâng cấp là Render Pro workspace + 1–2 paid API replicas, một worker riêng, và Neon Launch. Có thể bắt đầu ở mức khoảng **$57/tháng** với 1 API, hoặc **$82/tháng** với 2 API replicas, _chưa gồm database_; sau đó cộng database Neon theo CU-hours/storage/transfer. Đây là ngân sách cấu hình tham khảo, không phải dự báo năng lực.
- Với **5.000 đơn/ngày**, coi đó là nấc scale cần **đo trên staging trước khi mở tải**. Dựng 2 API replicas làm baseline, cấu hình autoscaling có giới hạn trên Render Pro, và bắt đầu database ở Neon Launch hoặc Scale tùy yêu cầu availability / SLA. Neon Scale có SLA cho compute endpoint, còn Render cam kết SLA uptime theo workspace trên Enterprise; không có lựa chọn nào trong hai phương án tạo ra SLA toàn ứng dụng chỉ nhờ nhà cung cấp.
- **Chưa có benchmark của ứng dụng trong ticket này.** Các tải ở dưới được suy ra từ giả định NFR đang ở trạng thái nháp; không chứng minh code, DB schema hay gói dịch vụ nào đã đạt các mục tiêu hiệu năng.

## 1. Workload giả định — và giới hạn suy luận

NFR của dự án đánh dấu các con số là **giả định, cần kiểm chứng bằng k6 trên staging**: 500–5.000 đơn/ngày; 20% đơn trong giờ bận nhất; khoảng 50 request đọc/đơn; promo burst gấp 5 lần trong 15 phút; 5.000 sản phẩm và 50.000 biến thể. NFR còn đặt mục tiêu P95 cho catalog/search, cart, quote ship, đặt đơn và IPN; các mục tiêu này cũng chưa phải kết quả đo. [NFR §1–3, §5](../architecture/10-nfr.md).

Từ đó suy ra **request rate mô hình hóa**, không phải capacity đã đo:

| Quy mô         | Đơn trong giờ bận (20%) | Request đọc/giây ở giờ bận | Request đọc/giây ở promo ×5 | Đơn/giây ở promo ×5* |
| -------------- | ----------------------: | -------------------------: | --------------------------: | -------------------: |
| 500 đơn/ngày   |                 100/giờ |                       1,39 |                        6,94 |                0,139 |
| 5.000 đơn/ngày |               1.000/giờ |                      13,89 |                       69,44 |                1,389 |

`request đọc/giây = đơn/ngày × 20% × 50 request đọc/đơn ÷ 3.600`; cột promo là rate giờ bận nhân 5. Cột đơn/giây giả định promo cũng nhân 5 **cho order rate**; NFR không khẳng định chính xác conversion hoặc số lần submit checkout trong promo, vì vậy phải xác nhận mix này với dữ liệu sản phẩm/kinh doanh trước khi dùng làm workload chuẩn. 50 request đọc/đơn cũng không cho biết tỷ lệ đọc/ghi toàn cục, kích thước payload, SQL/request, fan-out nội bộ, phân bố cache hit, retry, back-office traffic hay số transaction đồng thời.

Kiến trúc dự án mô tả modular monolith NestJS/PostgreSQL/Prisma, API stateless có thể chạy nhiều replica và worker riêng cho outbox/BullMQ; PostgreSQL là nguồn dữ liệu thương mại chuẩn tắc. Vì vậy tải request HTTP không thể quy đổi trực tiếp thành số query/giây hay transaction/giây. [Architecture overview §2–5](../architecture/01-overview.md).

## 2. Task 11 — demo miễn phí, không phải baseline production

Wayfinder quy định pilot là 500 đơn/ngày và 5.000 đơn/ngày là nấc scale-up; đồng thời nêu rõ task 11 hiện hữu chỉ là demo Render/Neon miễn phí, không xem là production configuration. Đây là nội dung trong `docs/plan/initiatives/fashion-store-mvp-implementation/map.md` của source checkout; thư mục Wayfinder đang untracked nên không được sao chép vào docs/research branch. Task 11 spec nhắm đến URL HTTPS miễn phí cho demo và ghi “production thật” ngoài phạm vi. [Task 11 spec](../plan/tasks/todo/11-deploy-render-free/spec.md).

Giới hạn hiện hành cần lưu ý:

| Free service            | Giới hạn được nhà cung cấp công bố                                                                                                                                                                              | Ý nghĩa vận hành                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Render Free Web Service | Ngủ sau 15 phút không có traffic inbound; request kế tiếp khởi động lại trong khoảng một phút; 750 instance-hours/tháng chia sẻ theo workspace; tối đa một instance; có thể restart; không dành cho production. | Cold start ảnh hưởng checkout và health/latency; không thể scale ngang hay dựa vào availability ổn định. |
| Render Free Postgres    | 1 GB; tự hết hạn 30 ngày sau khi tạo (14 ngày grace period để nâng cấp trước khi xóa); có thể maintenance/restart; không có backup hoặc managed connection pooling.                                             | Không phù hợp làm nguồn dữ liệu đơn hàng production, bất kể throughput.                                  |
| Neon Free               | 100 CU-hours/project, 1 GB Postgres/project, 5 GB public network transfer/project; compute bắt buộc scale-to-zero sau 5 phút; không có uptime SLA.                                                              | Hạn mức phù hợp prototype; nhàn rỗi rồi resume không tương đương database luôn sẵn sàng.                 |

Nguồn: [Render Free services/databases](https://render.com/docs/free); [Neon plans](https://neon.com/docs/introduction/plans), truy cập 2026-11-21. Neon hiện mô tả compute phản hồi trở lại trong **vài trăm mili giây** sau truy vấn, nhưng con số này chỉ nói về reactivation của compute; không gồm cold start của Render API, TLS/network, Prisma connection setup, query warm-up hay latency tổng của request. [Neon scale-to-zero](https://neon.com/docs/introduction/scale-to-zero).

Vì vậy, nội dung cũ trong Task 11 plan về Neon “~0,5 GB” và “~1 giây resume” không còn khớp với trang plans/scale-to-zero hiện tại: giới hạn là 1 GB/project và docs mới mô tả resume trong vài trăm mili giây. Đây là chỉnh lý thông tin, không đổi mục tiêu demo của Task 11. [Task 11 plan](../plan/tasks/todo/11-deploy-render-free/plan.md); [Neon plans](https://neon.com/docs/introduction/plans); [Neon scale-to-zero](https://neon.com/docs/introduction/scale-to-zero).

## 3. Các phương án production và ngân sách tham khảo

### Cấu hình ứng dụng dùng chung để so sánh

Render Pro workspace hiện có giá **$25/tháng** và mở các tính năng autoscaling, latency metrics, v.v. Gói service `1c-2g` (1 CPU/2 GB RAM) là $25/tháng mỗi instance; `0.5c-512mb` là $7/tháng. [Render pricing](https://render.com/pricing#compute); [Render compute plans](https://render.com/docs/compute-plans); [Render plan features](https://render.com/docs/platform-features-by-plan).

| App baseline (Singapore)     | Thành phần                                                                | Tổng app/workspace mỗi tháng, trước DB |
| ---------------------------- | ------------------------------------------------------------------------- | -------------------------------------: |
| Pilot lean                   | Render Pro workspace $25 + 1 API `1c-2g` $25 + 1 worker `0.5c-512mb` $7   |                                **$57** |
| Pilot/scale staging baseline | Render Pro workspace $25 + 2 API `1c-2g` × $25 + 1 worker `0.5c-512mb` $7 |                                **$82** |

Đây là giá chạy liên tục 24/7 cho số instance đã chọn, không gồm egress vượt hạn mức, build overage, lưu trữ bổ sung, Redis, object storage, email, monitoring bên thứ ba hay backup/export ngoài gói. Render tính phí từng instance theo compute; mọi instance scaled dùng cùng compute plan. Pro cần thiết nếu muốn autoscaling; manual scaling và autoscaling là hai chế độ khác nhau. Mặc dù Render có thể scale service tự động ngay khi CPU/RAM vượt ngưỡng đã đặt, một burst 15 phút vẫn phải kiểm thử vì scaling không thay thế capacity đã provision, warm-up, connection budget hay database throughput. [Scaling Render services](https://render.com/docs/scaling); [pricing](https://render.com/pricing).

### A — Render app + Neon Launch/Scale

Neon tính compute theo CU-hour và storage theo GB-month; không có mức phí tối thiểu cho Launch/Scale. Giá hiện tại: Launch **$0,106/CU-hour**, Scale **$0,222/CU-hour**; storage **$0,35/GB-month**; mỗi plan gồm 500 GB/project public transfer, sau đó $0,10/GB. Free/Launch scale-to-zero sau 5 phút; Launch có thể tắt scale-to-zero, Scale cho phép thời gian idle cấu hình từ 1 phút đến luôn hoạt động. Launch autoscale tối đa 16 CU; Scale autoscale tối đa 16 CU hoặc compute cố định đến 56 CU. [Neon plans](https://neon.com/docs/introduction/plans); [Neon pricing](https://neon.com/pricing).

Neon công bố một workload mẫu “medium load” gồm 720 CU-hours và 10 GB, ước tính **$80/tháng trên Launch** hoặc **$163/tháng trên Scale** (chỉ database compute + storage, chưa gồm các loại dịch vụ khác). Cộng Render baseline $82 cho ra khoảng:

| Database theo workload mẫu Neon | DB compute + 10 GB storage | Cộng app baseline $82 | Lưu ý                                                                         |
| ------------------------------- | -------------------------: | --------------------: | ----------------------------------------------------------------------------- |
| Neon Launch                     |                 ~$80/tháng |       **~$162/tháng** | Paid, có thể tắt scale-to-zero, nhưng không có uptime SLA.                    |
| Neon Scale                      |                ~$163/tháng |       **~$245/tháng** | Neon công bố có SLA cho compute endpoint trên Scale; không phải SLA toàn app. |

Đây là **ví dụ so sánh giá của Neon**, không phải dự báo cho Fashion Store. Một 0,25 CU chạy 24/7 tiêu thụ khoảng 180 CU-hours/tháng; 1 CU chạy 24/7 khoảng 720 CU-hours/tháng. Vì vậy, $80/$163 chỉ phù hợp nếu workload thật gần mẫu 720 CU-hours + 10 GB; điều chỉnh theo CU size/runtime/scale-up/egress/branch thực tế và bật spending notifications/alerts. Giá này được trích từ bảng cost examples của Neon; có thể biến động theo kế hoạch và cách sử dụng. [Neon pricing: typical monthly cost](https://neon.com/pricing#typical-monthly-cost); [Neon plans](https://neon.com/docs/introduction/plans).

**Độ tin cậy/giới hạn:** Neon Scale SLA chỉ áp dụng cho availability của **Compute Endpoints** trên Scale/Business, không bao phủ các phần khác của nền tảng hay API của ứng dụng; SLA cung cấp service credits theo điều kiện và loại trừ, không bảo đảm RPO/RTO riêng của cửa hàng. Neon Scale/Business mức chuẩn đòi hỏi availability ≥99,95% để không rơi dưới ngưỡng service-credit; điều này không thay cho SLO ứng dụng, database restore drill hay kiểm thử payment/GHN. [Neon SLA](https://neon.com/docs/legal/sla).

### B — Render app + Render Postgres HA

Render Postgres `1c-4g` (1 CPU/4 GB RAM) hiện giá **$55/tháng**. Tính năng HA yêu cầu ít nhất 1 CPU, tạo standby có cùng compute và storage, tính phí như primary. Với 10 GB được provision cho mỗi instance ở $0,30/GB-tháng, phần DB xấp xỉ **$110 compute + $6 storage = $116/tháng**; cộng app baseline $82 thành **~$198/tháng**. Vì trang giá không nêu riêng cách hiển thị storage HA trong bảng tổng, hãy xác nhận line item cuối cùng ở dashboard trước khi chốt ngân sách (nếu storage chỉ tính một lần, tổng này thấp hơn $3/tháng). [Render pricing: services/Postgres](https://render.com/pricing#postgresql); [Render Postgres HA](https://render.com/docs/postgresql-high-availability); [Render Postgres connections/setup](https://render.com/docs/postgresql-creating-connecting).

Render paid Postgres có PITR; cửa sổ phụ thuộc workspace plan: 3 ngày ở Hobby, 7 ngày ở Pro hoặc cao hơn. HA phát hiện primary không khả dụng trong 30 giây rồi failover trong vài giây; client phải reconnect. Replication bất đồng bộ nên có thể mất một số write mới nhất (thường chỉ vài giây theo tài liệu). Những điều này **không chứng minh** đạt RPO ≤5 phút/RTO ≤1 giờ của NFR cho toàn ứng dụng; cần diễn tập failover/restore và xác minh tiến trình xử lý đơn sau phục hồi. [Render HA](https://render.com/docs/postgresql-high-availability); [Render Postgres backups](https://render.com/docs/postgresql-backups); [NFR §3](../architecture/10-nfr.md).

### So sánh thực dụng

| Tiêu chí           | Render app + Neon Launch/Scale                                                                    | Render app + Render Postgres HA                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Ngân sách minh họa | ~$162 Launch / ~$245 Scale, dựa trên ví dụ 720 CUh + 10 GB và app $82                             | ~$198 với `1c-4g` primary + standby, 10 GB mỗi instance và app $82; xác nhận storage line item ở dashboard                       |
| Scale DB           | Neon autoscale theo CU; Scale cho phép fixed compute đến 56 CU                                    | Nâng compute/storage, read replicas ở plan đủ điều kiện; HA standby không phải read replica                                      |
| SLA / recovery     | Neon SLA trên Scale/Business compute endpoint; lịch sử PITR/instant restore theo plan và cấu hình | HA failover tự động trên cùng region; PITR paid theo cửa sổ workspace; Render workspace SLA contract chỉ được nêu cho Enterprise |
| Vận hành           | Server và DB khác provider; chọn cùng Singapore nhưng phải kiểm tra RTT và egress thực tế         | Một provider, internal connection URL khi app/DB cùng region, giảm public-network hop                                            |
| Hợp khi            | Muốn DB autoscale, billing theo dùng, cần SLA endpoint của Neon Scale                             | Ưu tiên một nền tảng vận hành và đường private networking; muốn failover DB rõ ràng                                              |

Render cho biết Enterprise có contractual uptime SLAs; không nên diễn giải Render Pro/Scale app plan hay riêng tính năng Render Postgres HA là SLA toàn ứng dụng. [Render pricing](https://render.com/pricing); [workspace plan features](https://render.com/docs/platform-features-by-plan). Cả hai lựa chọn đều cần app-level timeout/retry, health checks, alerts, backup restore test, và phương án vận hành thủ công cho cổng thanh toán/GHN.

## 4. Giới hạn và nút thắt cần kiểm tra

1. **Connection budget / pool saturation.** NFR đã nêu công thức `API replicas × pool API + worker × pool worker + migration/admin`, với ví dụ 2×10 + 1×5 + 5 = 30; giữ ít nhất 20% dưới `max_connections`. Render Postgres có 100 connection nếu RAM dưới 8 GB; managed PgBouncer nhận tối đa 30.000 client connections nhưng pool server bị giới hạn bởi kết nối DB thực (tối đa theo cấu hình, trừ 10 connection dự trữ). Neon PgBouncer cũng nhận tối đa 10.000 client connections, nhưng `max_connections` thay đổi theo compute; ở 1 CU là 450, pool hoạt động 405 cho mỗi user/database. **Client connection count không đồng nghĩa với số query đồng thời**; dùng pool không làm tăng CPU/IO/query capacity. [NFR §5](../architecture/10-nfr.md); [Render connection limits](https://render.com/docs/postgresql-creating-connecting); [Render pool](https://render.com/docs/postgresql-connection-pooling); [Neon pool](https://neon.com/docs/connect/connection-pooling).
2. **Transaction/lock contention ở tồn kho.** Checkout cùng biến thể ít hàng có thể serialize trên row lock; tăng API replicas không giải quyết điểm nghẽn này. Đo lock wait, transaction duration, deadlock/retry và xác minh không oversell. Không gọi GHN, payment hay service ngoài trong DB transaction; NFR đã yêu cầu transaction ngắn. [NFR §2, §4–5](../architecture/10-nfr.md).
3. **SQL/query shape, index và cache hit.** 50 request đọc/đơn là HTTP-level giả định, không cho biết truy vấn SQL/query plan hoặc fan-out. Tìm kiếm/sản phẩm với danh mục 5k sản phẩm/50k biến thể nên dùng dữ liệu kích thước tương đương; đo slow query, rows scanned, cache hit, CPU và IO thay vì chỉ tăng gói theo số order.
4. **Tích hợp ngoài và worker.** Quote ship có dependency GHN; payment/IPN và outbox/webhook cần idempotency, timeout và retry. Worker backlog hoặc retry storm có thể làm DB nghẽn dù request API thấp. Dùng sandbox/stub có độ trễ/lỗi định trước; test backlog drain, không gửi giao dịch hoặc webhook thật.
5. **Số replica và app resource.** CPU/RAM ở API, GC/event-loop latency, container restart/OOM, thời gian autoscale lên/xuống và worker concurrency đều có thể thành bottleneck. Pro workspace mở autoscaling và các percentile metrics trên Render; Neon monitoring có CPU/RAM/connections và lịch sử phụ thuộc plan. [Render plan features/metrics](https://render.com/docs/platform-features-by-plan); [Neon monitoring](https://neon.com/docs/introduction/monitoring-page).
6. **Độ trễ khu vực và transfer.** Render có region Singapore; Neon có AWS Singapore `aws-ap-southeast-1`. Đặt cả app và DB ở Singapore để tránh cố ý chọn hai vùng xa, nhưng Render internal DB URL chỉ dùng cho Render Postgres cùng account/region; Neon kết nối từ Render là dịch vụ cross-provider và phải đo RTT/egress thực tế. Neon project không thể đổi region sau khi tạo. [Render regions](https://render.com/docs/regions); [Neon regions](https://neon.com/docs/introduction/regions); [Render Postgres connections](https://render.com/docs/postgresql-creating-connecting).

## 5. Cách capacity-test trước khi tăng pilot

NFR yêu cầu k6 trên **staging**; quy trình đề xuất dưới đây là kế hoạch test, không phải kết quả benchmark:

1. **Tạo môi trường tương đồng production** ở Singapore: cùng loại Render service/compute, worker, database plan/pool, Redis nếu code path thực sự sử dụng, logging và cấu hình timeout; seed dataset thực tế cỡ 5.000 products/50.000 variants, bao gồm index và stock distribution. Không dùng production database.
2. **Lập script k6 theo journey và request mix**: duyệt danh sách/tìm kiếm/chi tiết, cart, quote, checkout, inventory update, payment callback/idempotency, worker/outbox. Dùng payment/ship sandbox hoặc stub được kiểm soát; không tạo charge, đơn, email hay vận đơn thật. Tải phải có traffic back-office/webhook nếu dự kiến vào giờ bận. Ghi rõ request/order ratio và conversion, thay vì suy luận transaction rate từ “orders/day”.
3. **Chạy lần lượt ba profile**: pilot 500/day peak (100 order/hr, ~1,39 read/s), target 5.000/day peak (1.000 order/hr, ~13,89 read/s), và promo burst **5× trong 15 phút** (~6,94/69,44 read/s tương ứng). Tách order-submit rate thành tham số được người phụ trách sản phẩm xác nhận; con số giả định nếu nhân 5 là 0,139/1,389 order/s. Ramp-up, warm-up và steady state nên được ghi lại cho từng lượt; làm thêm một headroom run sau khi đạt target để biết biên, không coi headroom đó là NFR hiện có.
4. **Tạo contention có chủ đích** trên cùng biến thể tồn kho thấp; kiểm thử retry, idempotency key, duplicate IPN, webhook lặp và transaction cancellation. Kiểm tra dữ liệu cuối cùng: không oversell, không có order/payment trùng và outbox được drain đúng. Không chỉ xem HTTP 2xx.
5. **Thu thập đồng thời**: route-level p50/p95/p99/error rate; API/worker CPU, RAM, restart; Postgres CPU/RAM/storage, query latency/slow SQL, lock waits/deadlocks, active/idle connections, pool wait/timeout; queue backlog/age, retry, network RTT/egress. Dùng Render Pro response percentiles, Postgres metrics/logs và Neon Monitoring/Query performance tùy cấu hình. [NFR §2–5](../architecture/10-nfr.md); [Render latency metrics](https://render.com/docs/platform-features-by-plan); [Neon monitoring](https://neon.com/docs/introduction/monitoring-page).
6. **So kết quả với ngưỡng đã có** trong NFR nháp: P95 catalog/search <300 ms, cart <200 ms, quote <800 ms (GHN/backup), order <1 s, IPN <200 ms; không oversell, không duplicate, không 5xx do cạn pool; để ≥20% connection budget trống. NFR còn ghi 99,5% API monthly availability, RPO ≤5 min, RTO ≤1 hour—cần diễn tập failover/restore riêng; throughput test không kiểm chứng SLA/DR. [NFR §2–5](../architecture/10-nfr.md).
7. **Điều kiện tăng tải**: giữ nguyên workload script/dataset, lưu kết quả và cấu hình, xử lý bottleneck lớn nhất trước, chạy lại sau mỗi thay đổi. Chỉ nâng 500 → 5.000 đơn/ngày khi target peak và promo burst đạt tiêu chí nghiệp vụ/performance trong các lượt staging lặp lại, còn capacity headroom và có kết quả restore/failover được ghi nhận. Không suy diễn năng lực từ instance size hoặc giá.

## 6. Khuyến nghị theo giai đoạn

- **Demo:** thực hiện Task 11 trong đúng phạm vi Free, không chứa dữ liệu khách hàng/đơn hàng thật và không đưa ra cam kết production.
- **Pilot:** dùng paid Render Pro app và database trả phí. Bắt đầu với 1 API + 1 worker (~$57/tháng) chỉ khi traffic pilot nhỏ, có thể chấp nhận maintenance risk; nếu yêu cầu app redundancy/rolling scaling, dùng 2 API (~$82). Render + Neon Launch là lựa chọn cost-aware; tắt scale-to-zero cho production endpoint và kiểm tra budget alert, connection pool, restore. Giữ RPO/RTO ở mức “chưa xác minh” đến khi drill.
- **Nấc 5.000/ngày:** lấy 2 API replica + autoscaling giới hạn làm baseline staging. Chọn Neon Scale nếu cần SLA compute endpoint/quan sát dài hơn hoặc fixed DB compute lớn; chọn Render Postgres HA khi ưu tiên DB ở cùng provider và restore/failover đơn giản hơn. Hai lựa chọn đều cần kiểm chứng bằng workload thật; có thể cần nâng DB compute/worker/API theo số liệu.
- **Không tách microservices chỉ dựa trên order/day.** Kiến trúc hiện tại là modular monolith; nâng cấp CPU/DB, query/index, pool, worker concurrency hoặc cache sau khi có số liệu, rồi cân nhắc tách thành phần khi bottleneck và ranh giới nghiệp vụ đã được quan sát.

## Nguồn chính thức

Tài liệu dưới đây là của nhà cung cấp/nguồn dự án, truy cập **2026-11-21**:

1. Ticket pointer: `/home/thanhluongcong/Documents/fashion-store/be-demo/docs/plan/wayfinding/fashion-store-mvp-implementation/issues/07-pilot-hosting-capacity.md`. Wayfinder map và issue tree là untracked trong source checkout, nên không được sao chép sang docs/research branch. Task 11 spec/plan: [spec](../plan/tasks/todo/11-deploy-render-free/spec.md); [plan](../plan/tasks/todo/11-deploy-render-free/plan.md).
2. Dự án, giả định tải, P95, availability/RPO/RTO và connection budget: [NFR §1–7](../architecture/10-nfr.md); [Architecture overview](../architecture/01-overview.md).
3. Render Free services, Postgres and usage limits: https://render.com/docs/free.
4. Render pricing / workspace and compute prices: https://render.com/pricing#compute ; https://render.com/pricing#postgresql ; compute specifications: https://render.com/docs/compute-plans.
5. Render scaling, Pro autoscaling and limits: https://render.com/docs/scaling ; workspace features: https://render.com/docs/platform-features-by-plan.
6. Render Postgres connection limits, internal/external URLs and storage: https://render.com/docs/postgresql-creating-connecting ; PgBouncer: https://render.com/docs/postgresql-connection-pooling.
7. Render Postgres HA and recovery windows: https://render.com/docs/postgresql-high-availability ; https://render.com/docs/postgresql-backups.
8. Render regions and metrics: https://render.com/docs/regions ; https://render.com/docs/service-metrics.
9. Neon plan limits, compute rates, storage/transfer and examples: https://neon.com/docs/introduction/plans ; https://neon.com/pricing.
10. Neon scale-to-zero, pooling, monitoring and regions: https://neon.com/docs/introduction/scale-to-zero ; https://neon.com/docs/connect/connection-pooling ; https://neon.com/docs/introduction/monitoring-page ; https://neon.com/docs/introduction/regions.
11. Neon SLA terms and scope: https://neon.com/docs/legal/sla.
