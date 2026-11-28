# Software Testing Handbook — Unified Edition

Một bộ tài liệu duy nhất, độc lập công nghệ. Áp dụng cho web, mobile, desktop, API, CLI, SDK, embedded, data pipeline và distributed systems.

## Mục lục

- [Testing Strategy](01-testing-strategy.md)
- [Testing Architecture](02-testing-architecture.md)
- [Test Design Techniques](03-test-design.md)
- [Frontend Testing](04-frontend-testing.md)
- [Backend Testing](05-backend-testing.md)
- [Áp dụng testing cho mọi loại phần mềm](06-cross-platform-testing.md)
- [Full-stack Testing](07-fullstack-testing.md)
- [Anti Over-testing & Test Optimization](08-test-optimization.md)
- [Quality Measurement & Mutation Testing](09-quality-measurement.md)
- [Software Testing Quality Assessment](10-quality-assessment.md)
- [CI/CD Quality Gates & Definition of Done](11-ci-cd-and-dod.md)
- [Master High-Quality Testing Checklist](12-master-checklist.md)
- [Test Plan & Traceability Template](13-test-plan-template.md)
- [Test Code Examples (TypeScript/Jest)](14-code-examples.md)
- [Ví dụ và bảng tham chiếu bổ sung từ các trao đổi](14b-expanded-examples.md)
- [High-Quality Testing Guidelines for AGENTS.md / CLAUDE.md](15-ai-agent-guidelines.md)
- [Software Testing Quality Audit](16-ai-audit-prompt.md)

## Cách sử dụng

Đọc strategy, architecture và design trước; chọn FE, BE, full-stack hoặc cross-platform theo dự án. Dùng master checklist để triển khai, optimization để tránh dư thừa, quality assessment để audit, CI/CD và DoD để quyết định release. Các checklist có thể cùng đề cập một rủi ro nhưng phục vụ mục đích khác nhau; dùng cùng bằng chứng, không tạo thêm test chỉ để đánh dấu nhiều checklist. N/A phải có lý do; Not Assessed không phải PASS.

Các ngưỡng, trọng số và biểu đồ là đề xuất minh họa. Ví dụ code chưa chạy trên repository thực tế. Mở Markdown Preview trong VS Code sau khi giải nén; PNG được nhúng, SVG và Mermaid có trong diagrams/.

## Ghi chú hợp nhất

Đối chiếu hai Handbook cũ: các chương cùng tên hoặc giống nhau hoặc được mở rộng trong bản technology-agnostic; checklist thay các yêu cầu PostgreSQL/Redis cụ thể bằng database/cache tương ứng, và thêm tiêu chí đa nền tảng. Giữ bản mở rộng làm nền, không sao chép lại bản cũ. Tách chương FE/BE thành ba chương, giữ nội dung extension và prompt audit. Sơ đồ trùng tên được xác minh giống byte trước khi bỏ bản sao. Không phải bản chép nguyên văn cuộc trò chuyện; không loại bỏ mọi câu diễn đạt tương tự giữa các checklist khác mục đích.
