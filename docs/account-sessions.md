# Thời gian đăng nhập theo tài khoản

Trong Quản trị → Người dùng → Chỉnh sửa, đặt **Thời gian đăng nhập (ngày)** cho từng tài khoản.
Ví dụ: tài khoản manager đặt 30 ngày, tài khoản thu ngân đặt 60 ngày.
Quản lý cửa hàng cũng có thể đặt thời hạn cho nhân viên thuộc cửa hàng trong phần Nhân viên.

- Nhận số nguyên từ 1 đến 3650 ngày; tài khoản mới và tài khoản cũ chưa chỉnh dùng 7 ngày.
- Cấu hình theo từng tài khoản, không tự áp dụng cho tất cả người dùng cùng vai trò.
- Thời hạn tính từ lúc đăng nhập thành công, không tự gia hạn khi sử dụng.
- Thay đổi áp dụng từ lần đăng nhập tiếp theo; muốn nhận thời hạn mới ngay thì đăng xuất rồi đăng nhập lại.
- Khóa/xóa tài khoản hoặc thu hồi token vẫn được kiểm tra ở mỗi yêu cầu.

API quản lý người dùng và nhân viên nhận `session_duration_days` khi tạo/sửa, đồng thời trả trường này khi liệt kê.
Bỏ qua trường này khi cập nhật sẽ giữ nguyên giá trị. Không nhận thời hạn do client gửi trong yêu cầu đăng nhập;
JWT dùng giá trị đã lưu của tài khoản.

Sau khi triển khai, khởi động lại server để tự thêm cột `users.session_duration_days` vào MySQL/PostgreSQL.
