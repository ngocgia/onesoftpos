# Loa thông báo trên Android

## Bản sửa 1.3.3

Mã cũ đọc thông báo bằng Web Speech API (`speechSynthesis`), không có bộ đọc Android native. Các nút thử dùng Web Audio/Speech, còn công tắc chuông đơn mới và VietQR chưa được nối đầy đủ vào sự kiện thực tế.

APK 1.3.3 dùng `ToneGenerator` cho chuông và `TextToSpeech` cho tiếng Việt, qua cầu nối `OnesoftAudioBridge`. Không dùng điều hướng URL cho âm thanh, nên đọc thanh toán không cạnh tranh điều hướng với lệnh in. Native chỉ chấp nhận khi trang chính đang ở `https://onesoft.one`. Android 11+ được khai báo truy vấn dịch vụ TTS trong manifest. Tắt ứng dụng sẽ dừng và giải phóng âm thanh.

Web mới dùng `audio.js` để chọn Android native hoặc fallback trình duyệt. Công tắc và âm lượng lấy từ cấu hình loa của cửa hàng; mức 0 không phát âm thanh. Nút thử dùng mức âm lượng đang chỉnh, không buộc tối thiểu 10% như trước.

## Những thông báo đã nối

- Chuông khi có món mới xuất hiện trong danh sách KDS, gồm gọi thêm món. Lần tải đầu im lặng, tránh đọc lại đơn cũ. Đổi bộ lọc không phát lại món đã nhận diện.
- Đọc thông báo backend khi bếp bấm xong món; nhân viên khác nhận thông báo qua polling danh sách món đã xong. Chống đọc lặp cùng món trên một thiết bị.
- Đọc xác nhận VietQR sau khi API xử lý thanh toán thành công. Đây là giao dịch nhân viên xác nhận trên POS, không phải xác minh dòng tiền ngân hàng tự động. Không phát khi chỉ mở mã QR hoặc khi thanh toán lỗi.

Polling khoảng 8 giây trong lúc ứng dụng ở phía trước, theo quyền KDS/Món đã xong hiện có. Không có foreground service hoặc thông báo đẩy; không bảo đảm nhận đơn khi khóa màn hình, đóng app hoặc Android đưa app vào chế độ ngủ. Việc nhận thay đổi cấu hình loa từ thiết bị khác vẫn cần tải lại cấu hình/ứng dụng.

## Cài đặt và thử trên điện thoại

1. Triển khai `audio.js`, các file JS đã sửa và `index.html`; cài APK 1.3.3. Cập nhật APK riêng không tự triển khai mã web.
2. Mở **Nhiều hơn → Loa thông báo**, bật các loại cần dùng, đặt âm lượng trên 0, lưu. Nút âm lượng điện thoại điều khiển luồng âm thanh phương tiện.
3. Thử chuông và đọc VietQR mẫu. Nếu thiếu giọng tiếng Việt, ứng dụng hiện thông báo; cài/bật bộ chuyển văn bản thành giọng nói và tải dữ liệu tiếng Việt trong Cài đặt Android. App ưu tiên giọng Việt không cần mạng khi đã được cài.
4. Kiểm tra trên loa điện thoại trước, sau đó qua loa Bluetooth đã kết nối để phát âm thanh (loa âm thanh độc lập với máy in Bluetooth).
5. Từ thiết bị khác gửi món mới, chờ polling, kiểm tra đúng một tiếng chuông. Bấm xong món, kiểm tra thiết bị bếp và thiết bị nhân viên; tải lại danh sách không được đọc lặp.
6. Kiểm tra bật/tắt từng loại, âm lượng 0, VietQR thành công/thất bại và đọc đồng thời in hóa đơn.

Đã kiểm thử routing native, tiếng Việt/âm lượng, công tắc, chống lặp và điều kiện thanh toán bằng Node; biên dịch/lint Android. Chưa xác minh âm thanh nghe được trên điện thoại hoặc loa Bluetooth thực tế trong môi trường phát triển.

## Tài liệu Android

- [TextToSpeech](https://developer.android.com/reference/android/speech/tts/TextToSpeech)
- [TTS service visibility](https://developer.android.com/reference/android/speech/tts/TextToSpeech.Engine)
- [ToneGenerator](https://developer.android.com/reference/android/media/ToneGenerator)
