# Thời hạn và hình thức sử dụng cửa hàng

Trong trang Admin → Cửa hàng → Sửa & cấu hình, chọn **Hình thức sử dụng** (Thử nghiệm hoặc Chính thức),
**Thời gian kích hoạt** và **Thời gian kết thúc**. Thời gian nhập và hiển thị theo UTC+7.
Thời điểm kết thúc phải sau thời điểm kích hoạt. Để trống ngày bắt đầu để kích hoạt ngay;
để trống ngày kết thúc để không giới hạn thời hạn.

Cửa hàng cũ mặc định Chính thức, không đặt thời hạn. Hình thức Thử nghiệm không tự áp dụng số ngày cố định;
quản trị viên đặt thời gian kết thúc theo nhu cầu.

Trước giờ kích hoạt và từ đúng thời điểm kết thúc, API sẽ chặn cả đọc lẫn ghi dữ liệu nghiệp vụ:
sản phẩm, phòng bàn, đơn hàng, thanh toán, KDS, ca làm việc, báo cáo, kho, nhân viên, cấu hình menu và upload ảnh.
Kiểm tra diễn ra tại mỗi yêu cầu, áp dụng cả token đã đăng nhập, không cần cron hoặc khởi động lại khi đến hạn.
Cửa hàng khác tiếp tục hoạt động bình thường. Dữ liệu không bị xóa và không bị thay đổi hàng loạt.

ADMIN/SUPER_ADMIN vẫn mở được danh sách, thông tin và cấu hình cửa hàng để gia hạn.
Quản lý cửa hàng không thể thay đổi thời hạn, hình thức sử dụng hoặc tự mở khóa cửa hàng.
Sau khi gia hạn, cửa hàng tự truy cập được nếu trạng thái thủ công vẫn là ACTIVE;
nếu đã tạm khóa thủ công thì cần kích hoạt lại. Trạng thái truy cập được tính theo thời gian,
không ghi đè trạng thái khóa thủ công trong database.

API tạo/sửa cửa hàng nhận `usage_type` (TRIAL/OFFICIAL), `activation_at`, `expires_at`.
Thời gian phải theo ISO 8601 kèm múi giờ; null xóa giới hạn, bỏ qua trường khi cập nhật sẽ giữ nguyên.
API danh sách/chi tiết trả thêm `access_status`: ACTIVE, LOCKED, NOT_STARTED hoặc EXPIRED.
Yêu cầu dữ liệu của cửa hàng bị khóa nhận HTTP 403 cùng mã STORE_LOCKED, STORE_NOT_STARTED hoặc STORE_EXPIRED.

URL ảnh đã công khai (bao gồm R2) vẫn truy cập trực tiếp được; khóa API không thu hồi URL ảnh công khai.
Dữ liệu đã tải trước đó trên thiết bị cũng không thể thu hồi bằng khóa truy cập server.

Khởi động lại server sau triển khai để tự thêm cột vào MySQL/PostgreSQL.
