# Thích Gà POS cho Android

Ứng dụng Android dùng WebView để hiển thị **chính giao diện POS mobile của website** tại `https://onesoft.one/?mode=pos`. Bố cục, tính năng bán hàng và luồng API được cập nhật theo website. Dự án Android nằm riêng trong `android-pos/`. In trực tiếp cần cả web mới và APK từ phiên bản 1.3.0.

## Phạm vi ứng dụng

- Đăng nhập và làm việc bằng tài khoản POS hiện có; phiên được website lưu trong WebView.
- Menu, giỏ hàng, bàn, đơn hàng, KDS, thanh toán, ca làm việc và hóa đơn hoạt động theo quyền và cấu hình của website.
- Mục quản trị bị ẩn và các điều hướng đến `/admin.html` bị chuyển về POS.
- Kết nối `browser` mở hộp thoại in Android. Kết nối `bluetooth` hoặc `usb` in ESC/POS trực tiếp, xem [hướng dẫn K58](../docs/printing-k58.md). Liên kết HTTPS ngoài hệ thống mở trong trình duyệt thiết bị.
- Từ bản 1.3.4, hóa đơn tạm tính có QR thanh toán được in cả mã QR qua Bluetooth/USB. Cần cấu hình ngân hàng, số tài khoản và chủ tài khoản trong cài đặt cửa hàng. Ứng dụng tải ảnh QR trước khi gửi dữ liệu in; tải lỗi sẽ báo để thử lại.
- Cần Internet và website public hoạt động; app không lưu menu hoặc đơn hàng để dùng offline.

## In LAN trực tiếp (APK 1.3.7)

APK **1.3.12** sửa vòng quay tải trang bị kẹt sau in: `WebChromeClient.onProgressChanged` chỉ hiện loader khi tài liệu POS đang tải, không bật lại cho sự kiện tiến độ của `tgpos://`. Điều hướng in luôn ẩn loader; callback bắt đầu/lỗi trang bỏ qua các scheme ngoài website POS. Thông báo kết nối LAN thất bại vẫn là lỗi kết nối riêng, không được xem là in thành công sau khi vòng quay tắt.

APK **1.3.11** kiểm tra Bluetooth: cấp quyền `BLUETOOTH_CONNECT` trên Android 12+, giới hạn chờ quyền 60 giây và bỏ callback đã hết hạn để không ảnh hưởng job mới; chỉ chọn thiết bị ghép đôi không phải BLE-only; kiểm tra lại trạng thái ghép đôi trước kết nối; tách timeout kết nối 15 giây và gửi dữ liệu 90 giây, đóng socket để thoát lệnh bị treo. Không tự reconnect/in lại sau lỗi giữa phiếu. Vẫn dùng chung bố cục raster, QR và cắt giấy; nhịp 180 ms giữ cho Bluetooth vì chưa đo được buffer máy in thực tế. Chưa kiểm thử radio/giấy in trên máy thật. Máy Zywell Q822 bản tem USB+LAN người dùng gửi không có đường Bluetooth tương ứng.

APK **1.3.10** rà soát các kết nối: USB bỏ nghỉ cố định 180 ms, truyền theo số byte `bulkTransfer` thực nhận, giới hạn một lệnh in 90 giây và chờ quyền USB 60 giây. Mất kết nối/hết thời gian không tự gửi lại phiếu để tránh trùng. Khi app đóng, kết nối USB đang mở được đóng. RawBT được kiểm tra có activity nhận URI trước khi tạo payload; vẫn dùng dữ liệu raster đầy đủ, không cắt phiếu hoặc bỏ QR khi vượt 180.000 byte. Web chọn USB trực tiếp sẽ báo rõ cần app; dùng driver hệ điều hành phải chọn **Trình duyệt**. Chi tiết và giới hạn: [rà soát các phương thức in](../docs/printing-transport-audit.md).

APK **1.3.9** đóng băng DOM hóa đơn ngay lúc bấm in, dựng riêng bố cục hiện tại thành raster (căn giữa, bảng món, chữ đậm, tổng tiền, QR và chân hóa đơn), thay vì dùng bản văn bản thuần. Logic nằm trong `assets/receipt-snapshot.js` và `ReceiptRenderer.java`, không cần cập nhật website cho thay đổi bố cục này. Kiểm tra cửa hàng trước khi gửi dữ liệu nếu người dùng đã chuyển cửa hàng trong lúc dựng ảnh. Hỗ trợ snapshot dài tối đa 24.000 pixel chiều cao; dùng bitmap từng dải 128 dòng thay vì một bitmap toàn phiếu.

LAN bỏ khoảng nghỉ cố định 180 ms/dải, dựa vào TCP backpressure. RawBT cũng không nghỉ trong bước chuẩn bị dữ liệu; RawBT tự quản lý tốc độ tới máy in. Từ 1.3.10 USB cũng bỏ nhịp nghỉ cố định; chỉ Bluetooth giữ nhịp bảo thủ cho máy cũ. Khi dùng bản HTML, ảnh QR được nhúng từ ảnh đã tải nếu trình duyệt cho phép, nếu không dùng cache HTTPS dùng chung; lỗi tải QR dừng trước khi gửi giấy. Chưa đo tốc độ hoặc xác minh bản in trên máy Zywell thực tế.

APK **1.3.8** bổ sung đọc IP đã lưu từ `menuPersistence.read('printer', {})` nếu website cũ chưa truyền trường IP sang native, đồng thời phân biệt lỗi thiếu IP và IP sai định dạng. Không dùng IP mặc định hoặc IP của cửa hàng khác để in khi chưa nhận được cấu hình.

Trong app Android, chọn **Cài đặt máy in → Mạng LAN/Wi-Fi**, khổ **K80**, IP máy in (ví dụ `192.168.1.27`), lưu rồi in thử. App mở TCP tới cổng **9100** trên máy in và gửi raster ESC/POS tiếng Việt, QR, lệnh cắt theo thiết lập. Điện thoại/máy iPOS phải cùng mạng và không bị chặn truy cập mạng nội bộ. Mở được trang cấu hình HTTP của máy in chỉ xác nhận cổng web truy cập được; không xác nhận cổng in 9100 mở. Thử mục **Printer Test** trong trang cấu hình máy in để kiểm tra riêng phần cứng.

Cần cập nhật cả website và APK. Trước bản này, lựa chọn LAN chưa được triển khai và rơi về hộp thoại in Android. Trình duyệt không có bridge TCP; web mới sẽ báo rõ thay vì mở nhầm hộp thoại. Trên web Windows, chọn **Trình duyệt** và máy in đã cài driver TCP/IP; trên Android có thể cấu hình RawBT qua mạng rồi chọn **RawBT** trong app POS. Không gửi IP nội bộ sang backend hosting để in vì hosting không thuộc LAN cửa hàng. Cổng 9100 là cổng được app sử dụng, phải xác nhận máy in đang bật RAW TCP tại cổng này. Chưa xác minh in thực tế trên Zywell ZY-Q822.

## In qua RawBT trên máy iPOS

APK **1.3.6** sửa tùy chọn **Tự động cắt giấy**: website truyền `receipt_auto_cut_paper` sang Android, bộ in thêm đúng một lệnh `GS V 66 0` sau nội dung, QR, lời cuối và đẩy giấy. Lệnh dùng chung cho USB/Bluetooth và dữ liệu chuyển sang RawBT. Tắt tùy chọn thì chỉ đẩy giấy, không gửi lệnh cắt. Cần cập nhật cả website và APK. Máy phải có dao cắt hỗ trợ ESC/POS; hộp thoại in Android/trình duyệt vẫn do driver điều khiển. Nếu RawBT cũng được cấu hình tự thêm lệnh cắt, chỉ bật cắt ở một nơi để tránh cắt hai lần. Tham khảo [lệnh GS V của Epson](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_cv.html).

Từ APK **1.3.5**, vào **Nhiều hơn → Cài đặt máy in → RawBT**, chọn K58/K80/K85, lưu và bấm in thử. Phải cập nhật cả website/backend và APK; APK cũ sẽ báo cần cập nhật khi chọn RawBT.

Trước tiên mở RawBT trên máy, kiểm tra kết nối máy in đã cấu hình và in thử ngay trong RawBT. App chuyển dữ liệu ESC/POS sang đúng gói `ru.a402d.rawbtprinter` qua `rawbt:base64,` theo [ví dụ của tác giả RawBT](https://github.com/402d/DemoRawBtPrinter). Không cần chọn lại kết nối USB/Bluetooth bên POS khi đã chọn RawBT. Nội dung tiếng Việt và QR được dựng thành raster như luồng in trực tiếp.

Nếu không mở được RawBT, app hiện thông báo để cài/bật và cấu hình RawBT. Thông báo “Đã chuyển phiếu” chỉ xác nhận đã mở ứng dụng nhận, không xác nhận giấy đã in; kiểm tra lỗi kết nối trong RawBT. Phiếu vượt 180.000 byte raster bị từ chối trước khi gửi để tránh vượt giới hạn Intent Android; với phiếu dài hãy dùng USB/Bluetooth trực tiếp. Chưa xác minh trên phần cứng iPOS thực tế.

## Khoảng cách giao diện trên máy iPOS

Vào **Nhiều hơn → Giao diện máy POS**. Mặc định giao diện tự chừa vùng thanh hệ thống trên cả màn hình dọc và ngang. Nếu firmware của máy báo sai kích thước thanh trạng thái/điều hướng, nhập khoảng cách thêm ở cạnh trên, dưới, trái hoặc phải (0–160 px). Có thể bắt đầu bằng **Gợi ý máy iPOS: trên 32, dưới 64**, điều chỉnh theo máy rồi bấm **Lưu giao diện**. **Về mặc định** đưa các ô về 0 và bật tự động; bấm lưu để áp dụng.

Thiết lập lưu trong WebView trên từng máy, dùng chung cho nhân viên trên máy đó, không đồng bộ sang máy khác. Xóa dữ liệu ứng dụng sẽ xóa thiết lập. Thay đổi này nằm trong website POS; sau khi cập nhật các tệp web lên máy chủ, đóng/mở lại app để tải giao diện mới, không cần tạo APK mới. CSS tương thích với các biến inset và quy tắc được APK hiện tại chèn vào trang.

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
