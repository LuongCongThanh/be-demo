# Phân quyền theo bốn vai trò: guest, customer, staff, admin

Thay thế mô hình cũ `CUSTOMER`/`ORDER_STAFF`/`STORE_MANAGER`/`MASTER_ADMIN`.

Vai trò theo `business/02-actors-permissions.md`: `guest` (không có Tài khoản, nhận diện bằng cookie giỏ và số điện thoại), `customer`, `staff`, `admin`. Tài khoản nội bộ có đúng một vai trò `staff` hoặc `admin`; `admin` có mọi quyền của `staff`; Tài khoản nội bộ không mua hàng và bị từ chối đăng nhập storefront. Mỗi route khai báo tường minh danh sách vai trò được phép — không suy từ cây phân cấp — để ma trận quyền review được.

Phương án bị loại: tách nhiều vai trò back-office (order staff, store manager, kế toán) — business chưa cần ở MVP; kế toán nhận file xuất từ Admin.

Hệ quả: vô hiệu hoá Tài khoản Staff phải làm mất hiệu lực mọi phiên ngay (mỗi request kiểm tra phiên còn hiệu lực, không chỉ dựa vào access token chưa hết hạn); mọi thao tác ghi back-office được ghi audit (ai, lúc nào, trước/sau).
