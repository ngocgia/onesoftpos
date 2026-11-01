# OnesoftPOS for iOS

App iOS (Swift/UIKit thuần, không thư viện ngoài) bao quanh website POS `https://onesoft.one/?mode=pos` — tương đương bản Android trong `android-pos/`.

## Tính năng (so với bản Android)

| Tính năng | Android | iOS |
| --- | --- | --- |
| WebView POS + chặn trang `/admin` | ✅ | ✅ |
| Chuông + đọc thông báo tiếng Việt (native) | ✅ | ✅ (`AVSpeechSynthesizer`) |
| In nhiệt qua mạng LAN (IP:9100, ESC/POS raster) | ✅ | ✅ |
| In qua hộp thoại hệ thống (driver/AirPrint) | ✅ | ✅ |
| Snapshot hóa đơn DOM (giữ cột/mẫu/QR) | ✅ | ✅ (dùng chung `receipt-snapshot.js`) |
| Bluetooth / USB / RawBT | ✅ | ❌ iPhone không cho phép (chỉ máy in MFi). Chọn **Mạng LAN** hoặc **Trình duyệt** |

Bridge đặt `onesoftNativeLanPrint=true`, `onesoftNativeReceiptQr=true`, còn `onesoftNativePrint`/`onesoftNativeRawBt=false` — web đã có sẵn thông báo lỗi tiếng Việt thân thiện khi bấm vào các lựa chọn không hỗ trợ.

## Build file .ipa (không cần Mac)

Project build bằng GitHub Actions (repo public → runner macOS miễn phí):

1. Đẩy code lên GitHub (branch bất kỳ, mặc định workflow tự chạy trên branch `build-ios-app`; branch khác bấm tay).
2. Vào **GitHub → Actions → "Build iOS IPA" → Run workflow** (hoặc chờ push vào `build-ios-app`).
3. Chờ job xong (~3–6 phút) → mục **Artifacts** → tải `OnesoftPOS-unsigned-ipa` → giải nén ra `OnesoftPOS-1.0.0-unsigned.ipa`.

Build cục bộ (nếu có Mac): mở `ios-pos/OnesoftPOS.xcodeproj` bằng Xcode 14+, chọn target OnesoftPOS, Run.

## Cài lên iPhone bằng Sideloadly (Windows, Apple ID miễn phí)

File .ipa build ra **chưa ký số** — iPhone chỉ chạy app đã ký, nên phải ký lại bằng Apple ID:

1. Cài [Sideloadly](https://sideloadly.io/) trên Windows + iTunes (hoặc app Apple Devices từ Microsoft Store).
2. Cắm iPhone vào máy bằng cáp, bấm "Tin cậy" trên điện thoại.
3. Mở Sideloadly: kéo file `.ipa` vào, nhập Apple ID + mật khẩu (bật xác thực 2 lớp thì dùng mật khẩu app: appleid.apple.com → Đăng nhập và bảo mật → Mật khẩu app).
4. Bấm **Start**; trên iPhone: Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị → chọn Apple ID → **Tin cậy**.
5. Mở app OnesoftPOS.

**Giới hạn Apple ID miễn phí:** app hết hạn sau **7 ngày** (cắm máy mở Sideloadly bấm Start lại là xong, dữ liệu web vẫn giữ vì cùng bundle id), tối đa 3 app/Apple ID. Khi mua tài khoản Apple Developer ($99/năm) sẽ ký được 1 năm/TestFlight — khi đó bổ sung certificate vào Secrets của workflow để build .ipa ký sẵn.

## Ghi chú vận hành

- **In LAN**: máy in và iPhone phải cùng Wi-Fi; nhập IP máy in trong Cài đặt máy in của web (cổng 9100). Web tự validate IP.
- **Giọng đọc tiếng Việt**: nếu chưa có, mở Cài đặt → Trợ năng → Nội dung được nói → Giọng nói → tải giọng **Tiếng Việt (vi-VN)**.
- Nâng version: sửa `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` trong `OnesoftPOS.xcodeproj/project.pbxproj` (đổi thêm tên file ipa trong workflow nếu muốn).

## Cấu trúc

- `OnesoftPOS.xcodeproj/` — project viết tay, không cần Xcode để tạo lại.
- `OnesoftPOS/ViewController.swift` — WebView, cầu nối JS, xử lý `tgpos://print`, chặn admin, insets.
- `OnesoftPOS/ReceiptRenderer.swift` — dựng snapshot HTML thành lát ảnh (WKWebView ẩn).
- `OnesoftPOS/ThermalPrinter.swift` — ESC/POS qua TCP 9100 (Network.framework).
- `OnesoftPOS/EscPosRaster.swift`, `BitmapPixels.swift`, `PrinterNetworkAddress.swift` — port 1:1 từ Java.
- `OnesoftPOS/NativeSpeaker.swift` — chuông + đọc tiếng Việt.
- `OnesoftPOS/receipt-snapshot.js` — bản sao y nguyên của `android-pos/app/src/main/assets/`.
- `../.github/workflows/build-ipa.yml` — build unsigned .ipa.
- `../scripts/make-ios-icon.ps1` — tái tạo icon 1024px từ icon Android.
