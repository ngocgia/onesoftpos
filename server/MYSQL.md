# Chạy OnesoftPOS với MySQL 8

Ứng dụng backend dùng Node.js. Hosting cần cho phép chạy tiến trình Node.js và kết nối MySQL từ tiến trình đó. phpMyAdmin chỉ dùng để quản lý hoặc nhập dữ liệu; bản thân phpMyAdmin không chạy backend Node.js.

1. Tạo một database MySQL 8 trống trên hosting. Trong phpMyAdmin, chọn database đó rồi dùng **Import** để nhập [`src/db/mysql-import.sql`](src/db/mysql-import.sql). Tệp này tạo bảng và dữ liệu mẫu; không chứa thông tin đăng nhập MySQL của hosting.
2. Trên máy chạy backend, tạo `server/.env` từ `.env.example`. Điền `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` theo thông tin hosting. Nếu Node.js chạy cùng hosting với MySQL, `MYSQL_HOST=localhost` thường phù hợp. Nếu nhà cung cấp chỉ cho kết nối qua UNIX socket, điền thêm `MYSQL_SOCKET_PATH` do họ cung cấp. Nếu chạy ở máy khác, dùng địa chỉ MySQL được nhà cung cấp cấp và bật quyền kết nối từ xa nếu cần.
3. Chạy `npm ci` trong thư mục `server`, sau đó `npm start`. Có thể dùng `npm run db:init` để tạo bảng và dữ liệu mẫu trực tiếp từ Node.js thay cho bước Import nếu tài khoản MySQL có quyền tạo bảng.

Chỉ dùng một trong hai cách khởi tạo: Import qua phpMyAdmin hoặc `npm run db:init`. `npm run db:export-mysql` tạo lại tệp SQL nhập từ schema và seed trong repo.

## Cập nhật menu Nhiều hơn trên hosting đang có dữ liệu

Kiểm tra biến môi trường của backend có `DB_CLIENT=mysql`. Điền các biến `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` bằng thông tin hosting; không dùng cấu hình PostgreSQL của máy phát triển.

Chọn một trong hai cách bổ sung bảng cấu hình:

- Trong phpMyAdmin, chọn đúng database hiện tại rồi Import `src/db/migrations/20261009-menu-preferences.mysql.sql`.
- Hoặc chạy `npm run db:migrate-menu-mysql` trong thư mục `server` trên hosting.

Migration chỉ tạo bảng `menu_preferences` nếu chưa tồn tại, không xóa bảng và không chèn dữ liệu mẫu. Bảng dùng InnoDB và utf8mb4 để lưu tiếng Việt/emoji. Không nhập lại `mysql-import.sql` vào database đang sử dụng: tệp đó dành cho database trống.

Sau khi tải mã nguồn mới và chạy migration, khởi động lại ứng dụng Node.js trên hosting, rồi tải lại POS. Backend cũng tự tạo bảng này khi khởi động nếu tài khoản database có quyền CREATE TABLE.

Dữ liệu mẫu có tài khoản `admin` với mật khẩu tạm `123456`. Hãy đổi mật khẩu ngay khi đưa ứng dụng lên Internet, đồng thời đặt `JWT_SECRET` thành một chuỗi ngẫu nhiên dài. Không đưa tệp `.env` lên kho mã nguồn.
