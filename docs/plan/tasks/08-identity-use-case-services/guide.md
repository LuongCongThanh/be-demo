# Guide 08: Tách `AuthService` theo use case

## Đích

```text
src/modules/identity/services/auth/
├── registration.service.ts       (+ spec)
├── session.service.ts            (+ spec)
├── password-reset.service.ts     (+ spec)
├── account-profile.service.ts    (+ spec)
├── send-best-effort.ts           # helper nội bộ, không phải provider
├── password.service.ts           # giữ nguyên
└── token.service.ts              # giữ nguyên
```

## Cách làm

1. Mỗi lần tách một service: tạo class mới, **cắt** method (kể cả method private đi kèm) khỏi `AuthService`, rồi cho controller gọi service mới. Chạy test sau mỗi lần cắt.
2. Spec: chuyển nguyên khối `describe`, đổi `new AuthService(...)` hoặc `Test.createTestingModule` sang service mới, và xoá mock không dùng. **Không đụng vào `expect`.**
3. Đặt tên theo use case, không theo kỹ thuật (`SessionService`, không phải `JwtService2`).

## Gợi ý

- `sendBestEffort` chỉ là try/catch kèm log. Viết thành hàm thuần nhận `logger`, không cần `@Injectable`.
- Nếu một method cần cả Session lẫn Registration thì dấu hiệu là đang tách sai ranh giới. Dừng lại và ghi vào report.

## Bẫy

- Logger context: `new Logger(AuthService.name)` sẽ đổi thành tên service mới. Thay đổi này chấp nhận được (chỉ ảnh hưởng log); ghi vào report.
- Không tạo barrel `index.ts`.
