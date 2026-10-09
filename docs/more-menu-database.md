# Lưu database cho menu Nhiều hơn

## Các mục đã bổ sung

Bảng `menu_preferences`, khóa `(owner_type, owner_id, section)`, lưu JSON trong `payload` và thời gian cập nhật.

- Theo cửa hàng: `printer`, `workflow` (kênh bán/KDS), `shipping`, `number`, `einvoice`, `website`, `loyalty`, `speaker`.
- Theo tài khoản: `header`, `current_store`, `deletion_request`.
- Đổi mật khẩu: kiểm tra bcrypt mật khẩu hiện tại và cập nhật `users.password_hash`. Không ghi mật khẩu vào nhật ký.

Các mục doanh thu, thực đơn, phòng bàn, kho, nhân viên, phân quyền và lịch sử đã có API/database, tiếp tục dùng luồng hiện có. Đăng xuất chỉ xóa phiên trình duyệt. Không khôi phục mục Lịch sử thao tác đã bỏ khỏi menu.

## API

- `GET /api/store/menu-settings`: tải cấu hình cửa hàng hiện tại.
- `GET /api/store/menu-settings/:section`: tải một nhóm cấu hình.
- `PUT /api/store/menu-settings/:section`: lưu một nhóm; chỉ SUPER_ADMIN, ADMIN, STORE_MANAGER và phải có quyền cửa hàng.
- `GET/PUT /api/auth/preferences/:section`: tùy chỉnh của chính tài khoản đang đăng nhập. Chỉ chấp nhận header/current_store/deletion_request.
- `PUT /api/auth/password`: `{old_password, new_password}`.

Mọi yêu cầu được xác thực. Chọn cửa hàng được kiểm tra quyền và trạng thái hoạt động trước khi lưu. Không nhận owner_id từ client. API kiểm tra kiểu, trường, enum, kích thước và trả lỗi nếu database không kết nối; không báo lưu thành công bằng bộ nhớ tạm. Modal chỉ đóng sau lưu thành công. Ảnh header được thu nhỏ trước khi lưu.

## Khởi động và dữ liệu hiện có

Khởi động lại backend để nạp route và script mới, rồi tải lại trang POS. Server tự tạo bảng bằng CREATE TABLE IF NOT EXISTS; schema khởi tạo PostgreSQL/MySQL cũng đã được cập nhật. Bảng đã được tạo trên PostgreSQL cấu hình trong workspace.

Đã sửa bước seed kho trong kiểm tra kết nối PostgreSQL: chỉ chèn dữ liệu kho mẫu khi cửa hàng và tài khoản mẫu tương ứng còn tồn tại; không chèn vào cửa hàng đã xóa hoặc dữ liệu cửa hàng khác.

Cấu hình cũ trong localStorage không được tự động sao chép sang nhiều cửa hàng vì khóa cũ không chứa danh tính cửa hàng/tài khoản. Cấu hình database là nguồn dữ liệu mới; mở từng mục, kiểm tra và lưu cấu hình mong muốn.

## Giới hạn nghiệp vụ

Lưu cấu hình không tạo kết nối nhà cung cấp vận chuyển/HĐĐT, không tự triển khai đặt món công khai qua QR hoặc sổ điểm thành viên. Nút kiểm tra HĐĐT đã bỏ thông báo thành công giả lập. Cấu hình máy in/âm thanh/định dạng được lưu, nhưng các tùy chọn phần cứng, phát âm thanh tự động và làm tròn tiền vẫn cần luồng áp dụng tương ứng; lần thay đổi này không tuyên bố đã tích hợp những chức năng đó.

Yêu cầu xóa tài khoản được lưu với trạng thái PENDING và lý do; gửi lại cập nhật yêu cầu đang chờ. Chưa có quy trình duyệt yêu cầu trong admin. Tài khoản không bị xóa hoặc khóa khi gửi yêu cầu.

## Kiểm tra

- `npm test --prefix server`: 16/16 đạt, gồm phân tách owner/store, kiểm tra dữ liệu, lỗi DB, băm mật khẩu, quyền chọn cửa hàng, chuyển đổi MySQL, nối form và lỗi lưu giữ modal mở.
- PostgreSQL thật: ghi/đọc lại 11 nhóm cấu hình trong transaction, sau đó ROLLBACK.
- HTTP thật với router: thiếu đăng nhập bị 401; nhân viên đọc cấu hình cửa hàng được giao, nhưng không được PUT cấu hình (403).
- Chưa kiểm thử trực tiếp giao diện trình duyệt, thiết bị in, hay dịch vụ bên thứ ba. Chưa chạy tích hợp trên MySQL thật.
