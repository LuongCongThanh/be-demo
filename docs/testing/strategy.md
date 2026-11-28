# Chiến lược kiểm thử Backend

**Trạng thái:** Đã chốt cho MVP (2026-11-28). Luật chung cho cả ba ứng dụng (nguyên tắc, mức rủi ro, hành trình E2E full-stack, gate, audit) nằm ở `docs/testing/` của repo workspace [fashion-store](https://github.com/LuongCongThanh/fashion-store/tree/main/docs/testing). File này chỉ nói phần của Backend; quy ước chung về assertion, tên test và dữ liệu test nằm ở README của thư mục đó. Danh sách luật → kịch bản → tầng: [traceability.md](traceability.md).

Backend là nguồn sự thật cho mọi luật nghiệp vụ, nên phần lớn kiểm thử P0 nằm ở đây. CMS và Storefront ẩn nút hay validate form không thay được việc Backend từ chối.

## Tầng test

| Tầng             | Vị trí và tên file                                                    | Phụ thuộc                                                                       | Dùng cho                                                                       |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Unit domain      | `src/modules/<m>/domain/**/*.spec.ts`                                 | Không có                                                                        | Công thức tiền, làm tròn, phân bổ, điều kiện, chuyển trạng thái T1–T14         |
| Unit application | `src/modules/<m>/application/**/*.spec.ts`                            | Fake in-memory của Port (Persistence, `Clock`, `TransactionRunner`, Cổng ngoài) | Điều phối use case, mã lỗi nghiệp vụ, nhánh lỗi của Port                       |
| API              | `test/<admin\|storefront\|shared>/<m>/*.e2e-spec.ts`                  | App thật (`test/support/create-test-app.ts`), Postgres, Redis thật              | Status, mã lỗi, schema response, quyền, ownership, validation, tác động lên DB |
| Integration DB   | `test/system/*.e2e-spec.ts` hoặc cạnh API test của module             | Postgres thật                                                                   | Ràng buộc, transaction, rollback, khoá dòng, migration                         |
| Đồng thời        | `test/system/*-race.e2e-spec.ts`                                      | Postgres thật, nhiều request song song                                          | Hai người mua món cuối, lượt Voucher cuối, Kiểm kê, IPN lặp, job chạy chồng    |
| Contract         | CI `openapi:write` + `git diff --exit-code docs/openapi/openapi.json` | —                                                                               | Response thật khớp OpenAPI đã commit                                           |

Ghi chú thuật ngữ: trong repo này `*.e2e-spec.ts` là **API test** chạy app NestJS thật qua HTTP với DB thật. "E2E full-stack" (Storefront/CMS + Backend) là lớp khác, nằm ở repo workspace.

## Quy ước

- **Không mock thứ đang test.** Unit application dùng fake in-memory implement đúng interface Port, không `vi.mock` file adapter. API và integration không mock Persistence Port, Prisma hay `TransactionRunner`; chỉ thay Cổng ngoài (VNPay, MoMo, GHN, mail) bằng stub.
- **Stub provider ký chữ ký thật.** Stub VNPay, MoMo và GHN là công cụ test của repo này (API test dùng, E2E full-stack ở workspace khởi động qua script npm). Stub dùng chính hàm ký và kiểm chữ ký mà task 29 (VNPay, MoMo) và task 32 (GHN) thêm vào, với secret test, để test được IPN và webhook GHN sai chữ ký, lặp, sai số tiền, đến muộn, sai thứ tự (BR-PAY-02–05, `05-order-lifecycle` mục 4.1, 4.2).
- **Thời gian qua `Clock` port** ([ADR 0016](../adr/0016-clock-port-for-time-based-rules.md)). Unit dùng fake clock đặt giờ cố định; API và integration tua giờ qua fake clock của app test. Không `vi.useFakeTimers()` cho code đọc giờ nghiệp vụ, không `sleep` thời gian thật.
- **Test đồng thời** dùng request song song thật (`Promise.all` sau một barrier), không giả bằng hai lệnh tuần tự. Assertion kiểm kết quả cuối: đúng một bên thành công, Số lượng bán được không âm, không có Order hoặc Giữ hàng mồ côi.
- **Dữ liệu**: API test hiện chạy tuần tự trên một DB (`fileParallelism: false`). Mỗi test tự tạo Biến thể, Voucher, Tài khoản bằng factory trong `test/support/` với mã duy nhất; không dựa vào thứ tự file. Local dùng DB `fashion_store_e2e`, không bao giờ DB dev.
- **Tên test** theo quy ước chung (bắt đầu bằng mã luật); ở Backend mã có thể là `BR-*`, `T1`–`T14` hoặc `CMP-*`, ví dụ `it('T9: từ chối huỷ khi Vận đơn đang tạo')`.
- **Assertion kiểm cả tác động bị cấm**: request bị từ chối thì đếm lại Order, Payment, Giữ hàng, Hàng chờ xuất, lượt Voucher, lịch sử Tồn kho và Hoàn tiền không đổi.
- **Property-based** (fast-check) cho phân bổ Voucher (BR-ORD-02), hoàn tiền lũy kế (BR-RET-07) và Số lượng bán được (BR-INV-02).

## Theo kiến trúc Hexagonal

Test viết cho kiến trúc mới (ADR 0015), không viết thêm cho code chưa migrate để rồi phải viết lại:

| Thứ tự | Module                            | Task migrate | Ghi chú test                                                         |
| -----: | --------------------------------- | ------------ | -------------------------------------------------------------------- |
|      1 | inventory                         | 41           | `BR-INV-*`, đồng thời Kiểm kê (`stock-count-confirm-race`)           |
|      2 | voucher                           | 42           | `BR-VCH-*`, bảng quyết định điều kiện, lượt dùng đồng thời           |
|      3 | catalog/category                  | 43           | Cây danh mục, ẩn nhánh, bản dịch                                     |
|      4 | catalog product, option, pricing  | 44           | `BR-CAT-*`, `BR-PRC-*`                                               |
|      5 | cart                              | 45           | `BR-CRT-*`                                                           |
|      6 | checkout                          | 46           | `BR-ORD-*`, T1, T2, idempotency đặt đơn; đưa `Clock` vào nếu chưa có |
|      7 | identity access, internal account | 47           | Ma trận quyền Staff/Admin                                            |
|      8 | identity auth                     | 48           | Đăng ký, xác thực email, đăng nhập, refresh rotation, rate limit     |
|      9 | finalize                          | 49           | Bật lại ngưỡng coverage 50% trong `vitest.config.ts`                 |

Luật cho tính năng của các task chưa làm (spec trỏ tới dòng traceability, task chỉ done khi các dòng P0 có test PASS) nằm ở Roadmap trong README của workspace; cột **Task** trong traceability cho biết dòng nào thuộc task nào.

## Lệnh và CI

| Lệnh               | Chạy                                           | CI      |
| ------------------ | ---------------------------------------------- | ------- |
| `npm test`         | Unit (`**/*.spec.ts`)                          | PR      |
| `npm run test:cov` | Unit kèm coverage; sàn 50%                     | PR      |
| `npm run test:e2e` | API, integration, đồng thời trên Postgres thật | PR      |
| Stryker            | Mutation trên phạm vi tiền và tồn kho          | Nightly |

Phạm vi mutation, gate và mục N/A theo `docs/testing/quality-gates.md` của repo workspace.
