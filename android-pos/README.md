# Thích Gà POS cho Android

Ứng dụng Android dùng WebView để hiển thị **chính giao diện POS mobile của website** tại `https://thichgapos.giavdn.pro.vn/?mode=pos`. Bố cục, tính năng bán hàng và luồng API được cập nhật theo website. Dự án Android nằm riêng trong `android-pos/`; không cần sửa web hoặc server để chạy app.

## Phạm vi ứng dụng

- Đăng nhập và làm việc bằng tài khoản POS hiện có; phiên được website lưu trong WebView.
- Menu, giỏ hàng, bàn, đơn hàng, KDS, thanh toán, ca làm việc và hóa đơn hoạt động theo quyền và cấu hình của website.
- Mục quản trị bị ẩn và các điều hướng đến `/admin.html` bị chuyển về POS.
- Nút in hóa đơn trên web mở hộp thoại in của Android, với khổ mặc định 58/80 mm theo cấu hình cửa hàng. Liên kết HTTPS ngoài hệ thống mở trong trình duyệt thiết bị.
- Cần Internet và website public hoạt động; app không lưu menu hoặc đơn hàng để dùng offline.

## Mở và tạo APK

1. Cài Android Studio, Android SDK Platform 35 và JDK 17.
2. Mở thư mục `android-pos` bằng Android Studio và chờ Gradle đồng bộ.
3. Chạy trên Android 7.0 (API 24) trở lên hoặc chọn **Build > Build APK(s)**.

Từ terminal có Android SDK: `gradlew.bat assembleDebug` trên Windows, hoặc `sh ./gradlew assembleDebug` trên macOS/Linux. APK đầu ra là `app/build/outputs/apk/debug/app-debug.apk`. Bản debug đã kiểm tra được chép thành `ThichGaPOS-POS-debug.apk` ở thư mục này.

## Kiểm tra

Lệnh `assembleDebug` đã chạy thành công với Android SDK 35 và JDK 17; chữ ký APK debug đã được xác minh. URL POS public trả HTTP 200. Chưa có thiết bị hoặc trình giả lập để xác nhận trực tiếp việc hiển thị WebView, đăng nhập và in với máy in cụ thể.
