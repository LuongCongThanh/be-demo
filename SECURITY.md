# Security Policy

## Supported Versions

Dự án chưa phát hành phiên bản ổn định. Chỉ bản mới nhất trên nhánh `main`
được nhận bản vá bảo mật.

| Version             | Supported |
| ------------------- | --------- |
| `main` (mới nhất)   | ✅        |
| Commit / bản cũ hơn | ❌        |

## Reporting a Vulnerability

**Không** mở issue, discussion hay PR công khai cho lỗ hổng bảo mật.

Báo cáo riêng qua GitHub Private Vulnerability Reporting:
[Security → Report a vulnerability](https://github.com/LuongCongThanh/be-demo/security/advisories/new).

Vui lòng gửi kèm:

- Mô tả lỗ hổng và tác động.
- Endpoint, module hoặc file bị ảnh hưởng.
- Các bước tái hiện hoặc proof of concept.
- Phiên bản / commit đã kiểm tra.

## Quy trình xử lý

| Bước               | Thời gian dự kiến       |
| ------------------ | ----------------------- |
| Xác nhận đã nhận   | Trong 3 ngày làm việc   |
| Triage và đánh giá | Trong 7 ngày làm việc   |
| Bản vá             | Tùy mức độ nghiêm trọng |

- **Được chấp nhận:** lỗ hổng được vá trên `main`, sau đó công bố
  security advisory và ghi nhận người báo cáo (nếu muốn).
- **Bị từ chối:** bạn sẽ nhận giải thích lý do trong advisory.

Vui lòng không công khai chi tiết lỗ hổng trước khi bản vá được phát hành.

## Dependency Updates

Dependabot theo dõi `npm`, GitHub Actions và Docker; bản cập nhật được mở
thành PR vào nhánh `dev`.
