# Trang giới thiệu OneSoft

- `/` và `/index.html` mở trang giới thiệu lấy từ mẫu HTML đã cung cấp, giữ bố cục, màu sắc, demo, các khối tính năng/ngành hàng/bảng giá/liên hệ.
- `/?mode=pos`, `/index.html?mode=pos` tiếp tục mở giao diện bán hàng hiện tại. `/pos` chuyển đến `/?mode=pos`. URL app Android không đổi. Logout POS và đăng nhập từ admin tiếp tục trở lại POS.
- `/admin.html` thêm mục **Trang giới thiệu** cho ADMIN/SUPER_ADMIN. Có thể tìm và chỉnh nội dung chữ, liên kết, placeholder, nội dung từng ngành và giá tháng/năm. Thay đổi áp dụng sau khi bấm **Lưu nội dung trang giới thiệu**, dùng chung cho toàn website. Trang bán hàng và cấu hình cửa hàng không dùng các giá trị này.
- Hai nút nổi ở góc phải: **Tải APK Android** luôn hiển thị, trỏ tới `/download` để tải phiên bản mặc định đang được bật ở **Admin → Phiên bản APK**; **Lên đầu trang** xuất hiện sau khi cuộn 320 px. Nhãn hai nút sửa được ở nhóm **Tiện ích trang giới thiệu**. Cần có APK đã upload, bật cho tải và chọn làm mặc định để tải được; trang landing không tự đóng gói hoặc upload APK.
- Form tư vấn lưu vào database; admin xem tối đa 100 yêu cầu mới nhất. Form chỉ báo gửi thành công khi server xác nhận lưu; dữ liệu không được gửi email/tin nhắn tự động.

## Lưu trữ và triển khai

Dùng bảng `menu_preferences` hiện có: `owner_type=system, owner_id=0, section=landing` chứa nội dung; `owner_type=lead, section=landing` chứa form liên hệ. Không reset, init hoặc thay đổi cấu trúc database. Bảng được tạo sẵn bằng cơ chế `ensureMenuPreferences` hiện tại. Khi database không hoạt động, trang vẫn hiển thị nội dung mặc định trong HTML; chỉnh sửa và gửi liên hệ báo lỗi thay vì giả lưu.

API đọc nội dung công khai: `GET /api/landing`. API quản trị yêu cầu đăng nhập và quyền ADMIN/SUPER_ADMIN: `GET/PUT /api/admin/landing`, `GET /api/admin/landing/leads`. Nội dung được gán bằng textContent; liên kết chỉ chấp nhận HTTP(S), mailto, tel, anchor và đường dẫn nội bộ. Không nhận HTML/JavaScript tùy ý. Form có giới hạn gửi theo IP kết nối trong bộ nhớ tiến trình; đây chỉ là giảm spam cơ bản, hosting reverse proxy nên cấu hình rate-limit ở proxy nếu cần phân biệt IP khách.

Các tệp mới nằm trong `public/` và `server/src/`, được bao gồm bởi gói deploy hiện tại. Không cần cập nhật APK cho phần landing. Trang phải được phục vụ qua Node/Express của dự án để routing và API hoạt động; mở trực tiếp tệp HTML không thay thế được server.

CSS Tailwind đã biên dịch vào `public/css/landing.css`, Lucide 0.468.0 được lưu ở `public/vendor/lucide.min.js` (ISC). Chỉ font Google cần mạng ngoài; có font dự phòng. Trang landing không nạp CSS/JS của POS. Khi thay cấu trúc HTML hoặc utility class, tạo lại CSS bằng:

```bash
npx --yes --package tailwindcss@3.4.17 tailwindcss -c scripts/landing-tailwind.config.cjs -i scripts/landing-tailwind.css -o public/css/landing.css --minify
```

Danh sách trường mặc định ở `public/data/landing-fields.json` có ID tương ứng thuộc tính `data-landing-*` trên HTML. Không đổi ID khi chỉ sửa mặc định để giữ các chỉnh sửa đã lưu.
