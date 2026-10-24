# In hóa đơn K58: Bluetooth và USB

## Phạm vi

Hai cấu hình người dùng cung cấp có giấy khoảng 58 mm, vùng in khoảng 48 mm, giao thức ESC/POS và cổng USB/Bluetooth. Cấu hình đầu nêu 203 dpi và 384 điểm/dòng. Profile K58 dùng vùng 48 mm / 384 điểm. Xprinter XP-N58H cần chọn đúng biến thể có Bluetooth nếu dùng không dây.

Web hiển thị hóa đơn Unicode. Android 1.3.0 trở lên dựng chữ bằng font hệ thống rồi gửi ảnh đen trắng ESC/POS (`GS v 0`), tránh phụ thuộc bảng mã tiếng Việt của máy in. Ảnh được chia thành dải 64 dòng và gửi có nhịp để giảm nguy cơ tràn bộ đệm. Không gửi lệnh cắt giấy cho hai mẫu cắt tay này.

## Cấu hình và sử dụng

1. Triển khai web mới (`invoice.js`, `more-menu.js`, `index.html`) và cài APK mới. Chỉ tải lại website không bổ sung chức năng native cho APK cũ.
2. Trong **Nhiều hơn → Máy in**, chọn **K58**, **K80** hoặc **K85** theo giấy đang dùng. K58 dùng vùng 48 mm / 384 điểm. K80 và K85 dùng vùng in an toàn 72 mm / 576 điểm; K85 đặt trang giấy 85 mm và cần Android 1.3.1 trở lên. Đây là profile bảo thủ khi chưa có thông số đầu in của máy K85, không mặc định đầu in rộng bằng khổ giấy.
3. Bluetooth: ghép đôi máy in trong Cài đặt Android, chọn kết nối Bluetooth trong POS. Khi in, cấp quyền Thiết bị ở gần trên Android 12+, chọn đúng thiết bị. Hỗ trợ Bluetooth Classic SPP, không phải máy chỉ hỗ trợ BLE hoặc giao thức riêng.
4. USB: điện thoại cần hỗ trợ USB host/OTG và cáp OTG truyền dữ liệu. Chọn USB, chọn máy in và cấp quyền truy cập. Hỗ trợ giao diện USB printer hoặc vendor có bulk OUT nhận ESC/POS trực tiếp. Máy dùng USB serial cần driver riêng; không khẳng định tương thích chỉ từ hình thông số.
5. Windows: dùng driver máy in đúng model, khổ giấy 58 mm, tỷ lệ 100%, tắt header/footer của trình duyệt. Chọn **Trình duyệt** để mở hộp thoại in của hệ điều hành. **USB trực tiếp** chỉ dùng trong app Android; web sẽ báo cần dùng app thay vì tự chuyển sang hộp thoại. Web thông thường không gửi Bluetooth SPP trực tiếp.
6. Bấm **In thử** để lưu cấu hình hiện tại và in phiếu có tiếng Việt, tên món dài, tùy chọn, ghi chú, giảm giá và thuế qua đúng đường in.

App Android từ 1.3.7 hỗ trợ LAN trực tiếp qua TCP 9100; bản 1.3.9 dùng chung bố cục hóa đơn cho LAN/USB/Bluetooth/RawBT. Bản 1.3.10 bỏ nhịp nghỉ cố định của USB, kiểm soát thời gian chờ và kiểm tra RawBT đã cài/bật. Khổ A4 dùng lựa chọn **Trình duyệt**, không gửi tới máy nhiệt. Xem [kết quả rà soát](printing-transport-audit.md) về giới hạn từng kết nối.

## Dữ liệu hóa đơn

- Cửa hàng, địa chỉ, hotline; mã đơn, ngày giờ, bàn hoặc thông tin giao nhận; nhân viên.
- Món còn hiệu lực, biến thể, tùy chọn, ghi chú, số lượng, đơn giá gồm tùy chọn, thành tiền. Loại món đã hủy.
- Tạm tính, giảm giá, thuế, tổng tiền, phương thức thanh toán thực tế. In lại đọc bản ghi thanh toán thành công, không mặc định mọi đơn đã trả là tiền mặt.
- Tiền khách đưa và tiền thối khi có dữ liệu thanh toán tiền mặt; ghi chú đơn và lời cảm ơn.
- Phiếu tạm tính từ bàn gồm món đã gửi và món chưa gửi.

## Kiểm chứng

Chạy `npm test --prefix server`, `gradlew.bat assembleDebug lintDebug` trong `android-pos`.

Kiểm thử bộ mã hóa độc lập:

```powershell
javac -d android-pos/build/raster-test android-pos/app/src/main/java/vn/pro/giavdn/onesoftpos/EscPosRaster.java android-pos/test/EscPosRasterTest.java
java -cp android-pos/build/raster-test vn.pro.giavdn.onesoftpos.EscPosRasterTest
```

Trước khi xác nhận tương thích phần cứng, chạy trên **từng máy, từng kết nối**:

- Phiếu tiếng Việt: ă â đ ê ô ơ ư và chữ có dấu, đặc biệt dấu trên chữ hoa; không mất dấu, không cắt mép.
- Phiếu dài tối thiểu 50 món: còn đủ món cuối, tổng tiền và footer; tiền trên giấy khớp dữ liệu đơn.
- In lại đơn QR và tiền mặt: phương thức, tiền nhận và tiền thối đúng; không in món đã hủy.
- Từ chối quyền, ngắt kết nối, hết giấy, in liên tiếp: thông báo đúng, không tự in lại sau lỗi gây trùng phiếu.

Thông báo “đã gửi dữ liệu” chỉ xác nhận ứng dụng đã ghi dữ liệu, không xác nhận giấy đã in xong. Cần kiểm tra bản giấy khi máy không có phản hồi trạng thái.

Chưa có hai máy in vật lý trong môi trường phát triển để kiểm chứng giấy in, firmware và biến thể cổng kết nối. APK debug để thử nghiệm; bản nâng cấp Play Store cần ký bằng khóa phát hành hiện có.

## Tài liệu giao thức

- [Android: Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions)
- [Android: USB host](https://developer.android.com/develop/connectivity/usb/host)
- [Epson: GS v 0 raster image](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/gs_lv_0.html)
