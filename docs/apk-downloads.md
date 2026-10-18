# Phát hành APK

Tính năng APK chỉ dùng các module có sẵn của Node.js, không cần cài thêm `yauzl` hoặc chạy postinstall. Nếu website đã hoạt động, cập nhật `server/src/services/apkRepository.js` rồi restart ứng dụng Node.js/Passenger để áp dụng bản kiểm tra mới. Các thư viện nền của website vẫn cần cài khi dựng hệ thống lần đầu.

Trong `admin.html`, chọn **Phiên bản APK** (ADMIN hoặc SUPER_ADMIN):

1. Chọn **Tải APK lên**, nhập phiên bản và chọn file `.apk` (tối đa 150 MB).
2. Bật **Cho phép người dùng tải phiên bản này** để mở link công khai của phiên bản.
3. Bật **Dùng phiên bản này cho link /download** hoặc chọn **Đặt mặc định** trong danh sách.

`https://<domain>/download` trả file APK dưới dạng attachment để trình duyệt tải xuống, không cần đăng nhập. Link `/download?version=1.3.4` tải đúng phiên bản đó. Admin có nút sao chép link của mỗi phiên bản.

Bản bị khóa hoặc đã xóa trả HTTP 404, kể cả khi người dùng giữ link cũ. Tắt hoặc xóa bản mặc định sẽ làm `/download` trả 404 cho tới khi admin chọn bản khác. Hệ thống không tự chuyển về một bản cũ. Không có APK nào được công khai tự động trước khi admin tải lên và cho phép tải.

File nhị phân và danh sách phiên bản được lưu bền vững trên ổ đĩa trong `server/data/apks/`, ngoài thư mục public và ngoài Git. Có thể đặt biến môi trường `APK_STORAGE_DIR` thành đường dẫn tuyệt đối tới thư mục lưu trữ riêng. Sao lưu toàn bộ thư mục này, gồm `releases.json` và các file `.apk`, và gắn volume bền vững nếu triển khai bằng container. Dùng một tiến trình Node ghi vào thư mục này; các thay đổi trong cùng tiến trình được tuần tự hóa và ghi danh sách bằng đổi tên file tạm.

Nếu dùng reverse proxy, cấu hình giới hạn body cho `/api/admin/apks` tối thiểu 150 MB (ví dụ Nginx `client_max_body_size 150m`) và thời gian chờ phù hợp với mạng tải lên. Chuyển tiếp `/download` về Node; không đặt cache cho đường dẫn này và không công khai thư mục lưu APK như static files.

API quản trị:

- `GET /api/admin/apks`: danh sách phiên bản và link tải.
- `POST /api/admin/apks`: gửi nội dung file dạng binary, `Content-Type: application/vnd.android.package-archive`, kèm `X-Apk-Version`, `X-Apk-Filename` (encodeURIComponent), `X-Apk-Enabled` và `X-Apk-Default` (`true`/`false`). Cần Bearer token admin.
- `PUT /api/admin/apks/:id`: JSON `{ "enabled": true }` hoặc `{ "isDefault": true }`.
- `DELETE /api/admin/apks/:id`: xóa phiên bản và file.

Upload được truyền xuống ổ đĩa, kiểm tra giới hạn dung lượng và cấu trúc ZIP32 có AndroidManifest.xml, rồi tính SHA-256. Phần kiểm tra chỉ đọc metadata ZIP, không giải nén nội dung; không hỗ trợ ZIP64 hoặc ZIP nhiều phần. Tên file lưu trữ do server tạo; phiên bản trùng sẽ bị từ chối. Việc upload không thay thế kiểm thử ứng dụng hoặc xác minh chữ ký APK khi phát hành.
