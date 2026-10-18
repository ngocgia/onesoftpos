# Thích Gà POS cho Android

Ứng dụng Android dùng WebView để hiển thị **chính giao diện POS mobile của website** tại `https://onesoft.one/?mode=pos`. Bố cục, tính năng bán hàng và luồng API được cập nhật theo website. Dự án Android nằm riêng trong `android-pos/`. In trực tiếp cần cả web mới và APK từ phiên bản 1.3.0.

## Phạm vi ứng dụng

- Đăng nhập và làm việc bằng tài khoản POS hiện có; phiên được website lưu trong WebView.
- Menu, giỏ hàng, bàn, đơn hàng, KDS, thanh toán, ca làm việc và hóa đơn hoạt động theo quyền và cấu hình của website.
- Mục quản trị bị ẩn và các điều hướng đến `/admin.html` bị chuyển về POS.
- Kết nối `browser` mở hộp thoại in Android. Kết nối `bluetooth` hoặc `usb` in ESC/POS trực tiếp, xem [hướng dẫn K58](../docs/printing-k58.md). Liên kết HTTPS ngoài hệ thống mở trong trình duyệt thiết bị.
- Từ bản 1.3.4, hóa đơn tạm tính có QR thanh toán được in cả mã QR qua Bluetooth/USB. Cần cấu hình ngân hàng, số tài khoản và chủ tài khoản trong cài đặt cửa hàng. Ứng dụng tải ảnh QR trước khi gửi dữ liệu in; tải lỗi sẽ báo để thử lại.
- Cần Internet và website public hoạt động; app không lưu menu hoặc đơn hàng để dùng offline.

## Mở và tạo APK

1. Cài Android Studio, Android SDK Platform 36 và JDK 17.
2. Mở thư mục `android-pos` bằng Android Studio và chờ Gradle đồng bộ.
3. Chạy trên Android 7.0 (API 24) trở lên hoặc chọn **Build > Build APK(s)**.

Từ terminal có Android SDK: `gradlew.bat assembleDebug` trên Windows, hoặc `sh ./gradlew assembleDebug` trên macOS/Linux. APK đầu ra là `app/build/outputs/apk/debug/app-debug.apk`. Bản debug đã kiểm tra được chép thành `ThichGaPOS-POS-debug.apk` ở thư mục này.

## Phát hành lên Google Play

Bản release dùng upload key được cấu hình riêng trong `keystore.properties`. File thuộc tính và thư mục `keystore/` đã bị loại khỏi Git vì chứa bí mật. Phải sao lưu cả `keystore/upload-key.jks`, alias và mật khẩu ở nơi an toàn; các lần cập nhật sau phải dùng lại cùng upload key.

Tạo Android App Bundle để tải lên Play Console bằng `gradlew.bat bundleRelease` trên Windows hoặc `./gradlew bundleRelease` trên macOS/Linux. File đầu ra là `app/build/outputs/bundle/release/app-release.aab`.

Ứng dụng nhắm đến Android API 36 theo yêu cầu hiện tại của Google Play. Bản release đang để `minifyEnabled false`, vì vậy không tạo tệp ánh xạ R8/ProGuard; cảnh báo thiếu tệp gỡ rối trên Play Console có thể bỏ qua và không chặn phát hành.

## Kiểm tra

Lệnh `assembleDebug` đã chạy thành công với Android SDK 35 và JDK 17; chữ ký APK debug đã được xác minh. URL POS public trả HTTP 200. Chưa có thiết bị hoặc trình giả lập để xác nhận trực tiếp việc hiển thị WebView, đăng nhập và in với máy in cụ thể.
