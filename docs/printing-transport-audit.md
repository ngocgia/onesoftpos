# Rà soát phương thức in — APK 1.3.11

Các đường in trực tiếp Android dùng chung snapshot HTML → raster ESC/POS từ 1.3.9: căn giữa, bảng món, tiếng Việt, QR, tổng tiền và chân hóa đơn. Bản 1.3.10 bổ sung các sửa lỗi USB và kiểm tra RawBT. Đây là kết quả kiểm tra mã nguồn/mô phỏng; chưa thay thế kiểm chứng trên phần cứng.

| Kết nối | Đã kiểm tra / sửa | Giới hạn cần biết |
| --- | --- | --- |
| USB trực tiếp | Chọn interface Printer/Vendor, bulk OUT; cấp quyền; xử lý truyền thiếu byte đúng offset; bỏ sleep cố định; timeout mỗi lần truyền và toàn job; đóng kết nối khi dừng; không tự in lại khi lỗi | Android phải hỗ trợ USB host/OTG và dây dữ liệu. USB serial hoặc giao thức riêng chưa có driver. Cần in thử và rút/cắm lại dây trên máy thật |
| RawBT | Gói ESC/POS chứa nguyên ảnh bố cục, QR và lệnh cắt; không sleep khi tạo gói; kiểm tra app nhận URI; chặn gói quá lớn trước khi mở RawBT | Tối đa 180.000 byte gồm lệnh điều khiển. Phiếu dài có thể bị từ chối; dùng LAN/USB trực tiếp. Chỉ xác nhận chuyển gói, không có callback xác nhận giấy ra. Máy in và tốc độ do RawBT cấu hình |
| LAN | Truyền cùng raster qua TCP 9100; không sleep; validate IP; giới hạn kết nối và job | Cần cùng mạng, cổng 9100 đang mở; HTTP cấu hình máy in không chứng minh cổng RAW in được |
| Bluetooth trực tiếp | Classic SPP, quyền Nearby Devices (chờ tối đa 60 giây); bỏ qua callback quyền đã hết hạn; danh sách máy ghép đôi loại thiết bị chỉ BLE; kiểm tra lại ghép đôi; giới hạn kết nối 15 giây, gửi phiếu 90 giây; đóng socket khi lỗi/hết thời gian, không tự gửi lại | Không hỗ trợ BLE/giao thức riêng. Vẫn giữ nhịp 180 ms/khối cho thiết bị cũ, có thể chậm hơn LAN/USB. Bản Zywell USB+LAN không thể thêm Bluetooth chỉ bằng phần mềm |
| Trình duyệt | Hộp thoại in OS/driver, bố cục HTML và khổ giấy | Driver quyết định kết nối, tốc độ, hỗ trợ giấy và cắt. Nhập IP trong POS không tự cấu hình driver. Web chọn USB/LAN/RawBT trực tiếp sẽ báo cần app Android |

## Cắt giấy

App thêm lệnh cắt cuối job khi bật **Tự động cắt giấy**, tắt thì chỉ đẩy giấy. RawBT nhận nguyên các byte này. Nếu RawBT tự thêm cắt giấy trong cấu hình của nó, chỉ bật cắt ở một nơi để tránh cắt hai lần. Không thể bảo đảm lệnh cắt hoạt động với thiết bị không có dao hoặc firmware không hỗ trợ ESC/POS tương ứng.

## Kiểm thử đã thực hiện

- Test Java thuần: USB short write, offset, nội dung byte không thiếu/trùng, kết quả 0/-1/sai số byte, hủy và deadline không tiếp tục gửi; RawBT tại/vượt giới hạn không nhận một phần khối; raster K58/K80 và cắt bật/tắt.
- Test phiên Bluetooth bằng socket giả: kết nối bị treo bị đóng và không gửi dữ liệu; gửi bị treo bị đóng; lỗi giữa phiếu không tự gửi lại; hủy timer sau thành công/lỗi. Đây không phải thử sóng radio hoặc đo tốc độ trên máy in thật.
- Test Node: chọn transport, capability APK, chặn web/old APK fallback, A4, IP, QR, nhận cài đặt mới và chặn in khi cửa hàng đổi. Snapshot đóng băng trước khi nội dung phiếu đặt đồ được phục hồi.
- `assembleDebug lintDebug`, kiểm tra chữ ký APK. Lint có cảnh báo SDK/deprecation/WebView tổng quát, không có lỗi chặn build.
- Chưa có thiết bị USB/RawBT kết nối trong môi trường kiểm thử. Cần xác nhận tiếng Việt, QR quét được, bản in dài, hết giấy, rút dây giữa phiếu, cấp/từ chối quyền và cắt giấy trên máy thật. Không tự chạy lại job lỗi khi chưa kiểm tra phiếu đã in bao nhiêu.

## Nguồn giao thức

- [Android USB host](https://developer.android.com/develop/connectivity/usb/host).
- [Android UsbDeviceConnection](https://developer.android.com/reference/android/hardware/usb/UsbDeviceConnection).
- [Android kết nối Bluetooth](https://developer.android.com/develop/connectivity/bluetooth/connect-bluetooth-devices), [quyền Bluetooth](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions).
- [Ví dụ tích hợp của tác giả RawBT](https://github.com/402d/DemoRawBtPrinter): `rawbt:base64,` và package `ru.a402d.rawbtprinter`.
