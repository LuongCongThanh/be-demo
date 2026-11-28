# Áp dụng testing cho mọi loại phần mềm

| Loại hệ thống  | Rủi ro ưu tiên                        | Test phù hợp                           |
| -------------- | ------------------------------------- | -------------------------------------- |
| Library/SDK    | Sai thuật toán, API breaking change   | Unit, property, fuzz, compatibility    |
| CLI            | Sai exit code, file bị ghi đè, signal | Unit, integration, subprocess          |
| Web/API        | Phân quyền, validation, session       | Component, API, contract, E2E          |
| Mobile/desktop | Offline, lifecycle, quyền thiết bị    | UI, device, lifecycle, upgrade         |
| Distributed    | Duplicate, ordering, partial failure  | Contract, concurrency, fault injection |
| Data pipeline  | Mất dữ liệu, schema drift             | Data quality, replay, reconciliation   |
| Embedded       | Timing, memory, hardware failure      | Simulator, hardware-in-loop, stress    |

## Quy trình lựa chọn

1. Xác định interface và observable outcomes.
2. Xác định invariants, trạng thái, dữ liệu và môi trường hỗ trợ.
3. Phân tích failure modes và mức độ ảnh hưởng.
4. Chọn tầng kiểm thử thấp nhất đủ phát hiện lỗi; bổ sung tầng cao hơn khi cần.
5. Thiết lập oracle độc lập, dữ liệu đại diện và khả năng tái hiện.
6. Chứng minh test phát hiện lỗi bằng regression hoặc mutation; ghi nhận giới hạn.
7. Chạy CI theo risk, kiểm tra release, theo dõi production và cải tiến.

Không áp đặt HTTP status cho CLI, UI test cho thư viện, database test cho phần mềm không lưu trữ, hay coverage threshold giống nhau cho mọi hệ thống. Với phần mềm an toàn trọng yếu cần tiêu chuẩn chuyên ngành và quy trình xác minh bổ sung.
