# Khuyến nghị kiểm soát xác thực và chống dò đơn hàng

> Ticket: `06-auth-abuse-control-guidance.md` — `/home/thanhluongcong/Documents/fashion-store/be-demo/docs/plan/wayfinding/fashion-store-mvp-implementation/issues/06-auth-abuse-control-guidance.md`
> Ngày nghiên cứu: **2026-11-21**
> Phạm vi: baseline MVP cho dịch vụ thương mại điện tử công khai, không thay thế đánh giá tuân thủ pháp lý theo khu vực.

## Tóm tắt baseline MVP đề xuất

| Chủ đề               | Baseline MVP thực tế                                                                                                                                                                                                                                                                                                                                                                     | Phân loại                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Mật khẩu             | Nếu mật khẩu là nhân tố đơn: tối thiểu **15 ký tự**; nếu đã có MFA và mật khẩu chỉ là một nhân tố: tối thiểu **8 ký tự**. Cho phép tối thiểu **64 ký tự**, không cắt bỏ, không quy tắc bắt buộc hoa/thường/số/ký hiệu, không thay đổi bắt buộc định kỳ. Kiểm tra toàn bộ mật khẩu với blocklist gồm mật khẩu phổ biến, bị lộ và từ khóa ngữ cảnh.                                        | NIST normative; ASVS/OWASP best practice/baseline                                                       |
| Throttling đăng nhập | Áp dụng tối thiểu hai chiều: giới hạn theo tài khoản và theo IP/thiết bị; tăng độ trễ sau một số lần sai hoặc chặn tạm khi vượt ngưỡng. Lộ trình MVP ví dụ: sau 5 lần sai trong 15 phút, CAPTCHA hoặc độ trễ tăng dần; tại 10 lần trong 15 phút, chặn tạm **15 phút**; không khóa vĩnh viễn. Tự reset sau đăng nhập thành công và không tiết lộ trạng thái khóa qua thông báo khác nhau. | Best practice/OWASP; NIST đặt giới hạn tối đa 100 lần sai liên tiếp trước khi vô hiệu hoá authenticator |
| Tra cứu đơn guest    | Yêu cầu đồng thời mã đơn khó đoán và bí mật tra cứu (mã bí mật ngẫu nhiên gửi/hiển thị khi đặt hàng); trả cùng HTTP status, nội dung và thời gian gần bằng cho “tìm thấy”/“không tìm thấy”; không lộ dữ liệu PII ngoài kết quả hợp lệ. Giới hạn 5–10 lần thử/15 phút theo chuỗi bí mật, mã đơn, IP và tránh cho phép truy vấn hàng loạt.                                                 | OWASP/API best practice; không phải một yêu cầu cụ thể mang tính tiêu chuẩn quốc tế                     |

## 1. Độ dài và mức mạnh mật khẩu

NIST SP 800-63B-4 quy định:

- Mật khẩu dùng như nhân tố xác thực đơn lẻ phải tối thiểu **15 ký tự**; khi được dùng trong quy trình đa nhân tố, có thể ngắn hơn nhưng không dưới **8 ký tự**.
- Verifier nên cho phép tối thiểu **64 ký tự** và không được cắt mật khẩu.
- Không được bắt buộc tổ hợp ký tự, chẳng hạn bắt buộc đồng thời hoa/thường/số/ký hiệu.
- Không bắt thay đổi mật khẩu định kỳ; bắt đổi nếu có bằng chứng credential bị lộ.
- Khi thiết lập hoặc đổi mật khẩu, phải so với blocklist gồm mật khẩu phổ biến, mật khẩu đã bị lộ và từ khóa ngữ cảnh; từ chối khi trùng blocklist.
- Không dùng mật khẩu bằng câu đố/KBA hoặc hint không xác thực.

NIST giải thích rõ rằng composition rules truyền thống ít hiệu quả và có thể làm người dùng lặp mẫu dễ đoán. Chiều dài và blocklist, kết hợp throttling và hashing an toàn, là các biện pháp hiệu quả hơn cho online guessing; periodic forced changes cũng không được khuyến nghị. OWASP ASVS v5.0 có mức tối thiểu lỏng hơn (ít nhất 8, 15 được khuyến nghị), tối thiểu 64 ký tự được phép ở level cao hơn, và yêu cầu kiểm tra ít nhất top 3000 mật khẩu ở mức cơ bản cũng như bộ breached password ở mức cao hơn.

**Baseline MVP đề xuất:** dùng **15 ký tự** làm minimum cho tài khoản password-only; dùng **8 ký tự** chỉ khi MFA thực sự bắt buộc và mật khẩu là một nhân tố. Cho phép tối thiểu 64 ký tự (nên hỗ trợ dài hơn nếu framework cho phép), tất cả ký tự Unicode/hợp lệ, paste và password manager, không cắt. Kiểm tra blocklist ở đăng ký và đổi mật khẩu; dưới MVP có thể bắt đầu bằng danh sách breach/cơ bản của Have I Been Pwned hoặc một top-password-list có kiểm soát, sau đó mở rộng danh sách ngữ cảnh. Không bắt quay vòng định kỳ.

## 2. Failed-login throttling và khóa tạm

NIST SP 800-63B-4 quy định verifier phải giới hạn consecutive failed authentication attempts; upper bound là không quá **100 lần** cho cùng authenticator/tài khoản trước khi vô hiệu hoá authenticator. NIST cho phép giới hạn thấp hơn và đề xuất delay tăng dần, CAPTCHA/bot detection hoặc risk-based controls để tránh làm chủ tài khoản bị khoá bởi hành vi của kẻ tấn công.

OWASP Authentication Cheat Sheet khuyến nghị counter gắn với tài khoản thay vì chỉ IP, đồng thời cấu hình ngưỡng, observation window và lockout duration. OWASP cũng cảnh báo lockout phải tránh tạo denial of service.

**Baseline MVP đề xuất:**

1. Thu thập attempted login theo **account + IP/ASN/risk signal**, không chỉ một chiều.
2. Ví dụ cửa sổ: 5 lần sai trong 15 phút kích hoạt delay/CAPTCHA; 10 lần trong 15 phút kích hoạt temporary lock 15 phút.
3. Không khóa vĩnh viễn trong MVP. Cho unlock bằng thời gian tự hết hạn và/hoặc password recovery hợp lệ; không cho kẻ tấn công khóa tài khoản bằng cách liên tục gửi sai.
4. Sau đăng nhập thành công, reset failed counter cho authenticator đã dùng.
5. Áp dụng throttling toàn cục/chung cho credential spraying và cho từng account; tránh để một login burst lách qua account-only hoặc IP-only limit.
6. Trả thông báo tương tự cho email không tồn tại và sai mật khẩu; không trả `account locked` riêng cho một tài khoản.
7. Ghi log thành công, thất bại, lock và unlock với user identifier/hash, IP, timestamp, user-agent; không ghi mật khẩu hay recovery secret.
8. MFA là defense mạnh hơn; nếu có thể, khuyến nghị MFA, nhưng không biến MFA thành yêu cầu bắt buộc trong mọi MVP nếu UX yêu cầu nghiên cứu riêng.

Các con số trên là lựa chọn MVP cân bằng bảo mật và UX, **không phải con số bắt buộc của NIST**. NIST upper bound 100 là giới hạn tối đa; môi trường có rủi ro cao nên đặt ngưỡng thấp hơn. OWASP cũng không quy định một lockout duration duy nhất.

## 3. Guest order lookup chống enumeration

Guest lookup thường tạo ba rủi ro:

- **Enumeration:** thử mã đơn/ID hoặc email/phone để phát hiện đơn tồn tại.
- **Broken object level authorization:** truy cập object ID mà không chứng minh quyền sở hữu bí mật.
- **Unrestricted resource consumption:** gửi hàng loạt request để dò mã hoặc tăng tải.

OWASP API Top 10 2023 xếp Broken Object Level Authorization ở API1 và yêu cầu mọi endpoint nhận record ID phải kiểm tra quyền truy cập trong mọi hàm truy cập record; prefer random/unpredictable GUID. OWASP API4 yêu cầu giới hạn execution, batch, memory và traffic khi resource không được giới hạn.

**Baseline MVP đề xuất:**

- Sinh **order reference ngẫu nhiên, khó đoán** (ưu tiên UUID hoặc chuỗi 128-bit theo CSPRNG), nhưng không coi đó là bí mật duy nhất.
- Yêu cầu cả `orderReference` và bí mật tra cứu riêng (lookup token ngẫu nhiên 128-bit hoặc secret được gửi qua kênh sở hữu như email/SMS). Không chỉ dựa trên tên, email, phone hoặc số điện thoại vì các trường này có thể bị suy ra hoặc lộ.
- Tại server, kiểm tra liên kết giữa reference và lookup secret, rồi kiểm tra authorization rule cho guest record. Không so sánh phản hồi dựa vào kết quả khác biệt.
- Với mọi hợp lệ/không hợp lệ, trả cùng HTTP status và body/schema; ví dụ: `Không thể xác minh đơn hàng bằng thông tin đã nhập`. Không lộ PII, trạng thái thanh toán, địa chỉ, hoặc chi tiết sản phẩm trước khi verify thành công.
- Cố gắng cân bằng thời gian xử lý để tránh account/order enumeration qua timing. Không có “fast return” ở nhánh không tồn tại.
- Giới hạn 5–10 lookup attempts trong 15 phút theo `orderReference + lookupSecret + IP + session`; lock tạm chuỗi đó 15–30 phút. Thêm CAPTCHA sau ngưỡng thấp nếu traffic bot đáng kể.
- Không trả danh sách các đơn gần nhau, không cho wildcard, prefix search, sequential scan hoặc batch lookup.
- Log lookup thất bại và thành công, masking reference/secret; cảnh báo repeated attempts và không lưu secret dạng plaintext.
- Nếu kênh email/SMS được dùng để gửi secret, đánh giá và giới hạn chi phí side-channel để tránh abuse.

## 4. Best practice, tiêu chuẩn và yêu cầu pháp lý

Phân loại cần hiểu rõ:

- **NIST SP 800-63B-4:** tiêu chuẩn/hướng dẫn kỹ thuật của chính phủ Hoa Kỳ. Đây là nguồn normative cho verifier trong ngữ cảnh 800-63, nhưng không tự động trở thành luật áp dụng cho mọi doanh nghiệp. Các từ “SHALL/SHOULD” trong tài liệu thể hiện yêu cầu của tiêu chuẩn; ngoài federal scope, vẫn là best practice trừ khi một hợp đồng hoặc luật địa phương bắt buộc.
- **OWASP Cheat Sheet/ASVS/API Top 10:** industry guidance và kiểm tra bảo mật, không phải luật.
- **GDPR:** nếu xử lý dữ liệu cá nhân của người trong EEA/UK, Article 32 yêu cầu measures phù hợp với rủi ro, bao gồm availability/confidentiality, pseudonymisation/encryption và kiểm thử đánh giá hiệu quả. Điều này ủng hộ các kiểm soát trên, nhưng không quy định cụ thể ngưỡng 15 ký tự, 10 lần sai hoặc 128-bit guest token.
- **PCI DSS:** nếu xử lý, lưu hoặc truyền dữ liệu card, các requirement của PCI DSS có thể là contractual/regulatory obligation cho tổ chức trong phạm vi. PCI DSS yêu cầu các policy liên quan đến lockout, mật khẩu và MFA theo ngữ cảnh PCI; không suy ra rằng toàn bộ storefront hoặc guest lookup nằm trong cardholder scope chỉ vì nhận thanh toán.
- Luật địa phương chưa thể kết luận một cách tổng quát mà không xác định quốc gia/khu vực kinh doanh. Đối với doanh nghiệp tại Việt Nam hoặc khi có người dùng ở EEA, cần luật sư/Compliance xác nhận Legality and Breach notification obligations, nhưng baseline kỹ thuật trên vẫn nên được xem là security baseline.

## Danh sách kiểm tra chấp nhận MVP

- Password registration/change chỉ cho phép 15 ký tự trở lên cho password-only; MFA account theo lower bound 8; 64 ký tự không bị cắt; không composition rule hay periodic rotation.
- Blocklist được kiểm tra ở registration/password change và lỗi cho lý do redaction-safe.
- Failed login có account and IP/risk throttling; thử nghiệm sai liên tiếp không khóa tài khoản vĩnh viễn; successful login reset state.
- Login/forgot-password/guest lookup không làm attacker phân biệt account hoặc đơn tồn tại qua status, body và timing đáng kể.
- Guest lookup endpoint có object authorization và CSPRNG token; không expose PII hoặc cho batch/sequential lookup.
- Repeated abuse được rate limit, log và alert; secrets không được log plaintext.
- MFA được ưu tiên cho account management/admin hoặc khi có sensitive PII; không coi MFA chỉ là khóa tránh password policy.

## Nguồn chính

1. NIST SP 800-63B-4, _Digital Identity Guidelines: Authentication and Authenticator Management_, 2025: https://pages.nist.gov/800-63-4/sp800-63b.html — đặc biệt phần [Password Verifiers](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#passwordver) và [Rate Limiting (Throttling)](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#throttle). Truy cập 2026-11-21.
2. NIST SP 800-63B-4, _Appendix A: Strength of Passwords_: https://pages.nist.gov/800-63-4/sp800-63b/passwords/#appA. Truy cập 2026-11-21.
3. OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html — password controls, login throttling/account lockout, CAPTCHA và logging. Truy cập 2026-11-21.
4. OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html — consistent messages/timing, token lifecycle và brute-force protection. Truy cập 2026-11-21.
5. OWASP ASVS v5.0, Authentication (V6): https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x15-V6-Authentication.md — L1/L2 password, rate limiting, MFA and account enumeration requirements. Truy cập 2026-11-21.
6. OWASP API Security Top 10 2023: [API1 Broken Object Level Authorization](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/) và [API4 Unrestricted Resource Consumption](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/). Truy cập 2026-11-21.
7. OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html. Truy cập 2026-11-21.
8. GDPR, Regulation (EU) 2016/679, Article 32: https://eur-lex.europa.eu/eli/reg/2016/679/oj — security of processing; primary EU legal source. Truy cập 2026-11-21.
9. PCI Security Standards Council, PCI DSS v4.0.1: https://www.pcisecuritystandards.org/document_library/ — primary standards library; áp dụng khi merchant/system nằm trong PCI DSS scope. Truy cập 2026-11-21.
