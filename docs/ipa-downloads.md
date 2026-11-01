# Phát hành IPA

Tính năng phát hành ứng dụng iOS (IPA) chỉ dùng các module có sẵn của Node.js, không cần cài thêm thư viện nén ngoài.

Trong `admin.html`, chọn **Phiên bản IPA** (ADMIN hoặc SUPER_ADMIN):

1. Chọn **Tải IPA lên**, nhập phiên bản (ví dụ `1.0.0`) và chọn file `.ipa` (tối đa 150 MB).
2. Bật **Cho phép người dùng tải phiên bản này** để mở link công khai của phiên bản.
3. Bật **Dùng phiên bản này cho link /download-ipa** hoặc chọn **Đặt mặc định** trong danh sách.

`https://<domain>/download-ipa` tự động tải file IPA mặc định dưới dạng attachment để trình duyệt tải xuống mà không cần đăng nhập. Link `/download-ipa?version=1.0.0` tải đúng phiên bản đó. Admin có nút sao chép link của mỗi phiên bản trong bảng quản trị.

Bản bị khóa hoặc đã xóa trả về HTTP 404. Tắt hoặc xóa bản mặc định sẽ làm `/download-ipa` trả 404 cho tới khi admin chọn bản khác.

File nhị phân và danh sách phiên bản được lưu bền vững trên ổ đĩa trong `server/data/ipas/`, ngoài thư mục public và ngoài Git. Có thể cấu hình biến môi trường `IPA_STORAGE_DIR` để trỏ tới thư mục lưu trữ tùy chỉnh.

API quản trị:
- `GET /api/admin/ipas`: danh sách phiên bản và link tải.
- `POST /api/admin/ipas`: upload file binary, `Content-Type: application/octet-stream`, kèm các header `X-Ipa-Version`, `X-Ipa-Filename` (encodeURIComponent), `X-Ipa-Enabled` và `X-Ipa-Default` (`true`/`false`). Cần Bearer token của admin.
- `PUT /api/admin/ipas/:id`: JSON `{ "enabled": true }` hoặc `{ "isDefault": true }`.
- `DELETE /api/admin/ipas/:id`: xóa phiên bản và file `.ipa`.

Upload được kiểm tra cấu trúc ZIP32, kiểm tra sự tồn tại của `Payload/*.app/Info.plist`, và tính mã băm SHA-256.

