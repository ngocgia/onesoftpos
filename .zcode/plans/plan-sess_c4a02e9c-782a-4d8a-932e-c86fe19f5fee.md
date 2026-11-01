# Build app iOS OnesoftPOS (.ipa) — song song với app Android hiện có

## Context
Dự án đã có app Android (`android-pos/`, OnesoftPOS 1.3.14): WebView bao quanh `https://onesoft.one/?mode=pos`, bridge âm thanh (beep/speak), in nhiệt ESC/POS (LAN 9100/BT/USB/RawBT), in qua hệ thống, chặn trang admin, inject CSS biến safe-area. Bạn muốn app iOS tương tự, xuất file `.ipa`, đang dùng **Windows** (không có Mac/Xcode) và **chưa có Apple Developer trả phí**. Repo GitHub `ngocgia/thichgapos` là **public** → GitHub Actions runner macOS miễn phí không giới hạn.

**Giải pháp**: viết app iOS thuần Swift/UIKit (không dependency, giống triết lý Android), tạo sẵn Xcode project bằng tay (không cần Xcode để tạo file), build `.ipa` **unsigned** qua GitHub Actions, bạn cài lên iPhone bằng **Sideloadly** ký Apple ID miễn phí.

## Giới hạn nền tảng iOS (không tránh được)
- **Bluetooth SPP, USB, RawBT không thể trên iPhone** (Apple chỉ cho Bluetooth với máy in MFi). App iOS hỗ trợ: **in LAN/Wi-Fi (port 9100)** + **in qua hộp thoại hệ thống** (AirPrint/driver). Bridge sẽ set `onesoftNativePrint=false`, `onesoftNativeRawBt=false`, `onesoftNativeLanPrint=true`, `onesoftNativeReceiptQr=true` — web `public/js/invoice.js` L201-223 đã có sẵn thông báo lỗi tiếng Việt thân thiện khi flag false → **không phải sửa gì phía web**.
- Apple ID miễn phí: app hết hạn 7 ngày/lần ký, tối đa 3 app (đã chọn chấp nhận).

## Files sẽ tạo

### 1. `ios-pos/OnesoftPOS.xcodeproj/project.pbxproj` (viết tay)
Zero dependency, Swift 5, iOS 15.0+, chỉ portrait + full screen, bundle id `vn.pro.giavdn.onesoftpos`, version 1.0.0 (1), không storyboard.

### 2. `ios-pos/OnesoftPOS/Info.plist` + `Assets.xcassets`
App icon single-size 1024×1024 (upscale từ `android-pos/.../app_icon.png` 512px bằng PowerShell), UILaunchScreen rỗng.

### 3. Source Swift (port 1:1 từ Java, programmatic UIKit)
- `AppDelegate.swift`, `ViewController.swift` — WKWebView full-screen; `decidePolicyFor`: chặn `tgpos://print` (xử lý in), chặn path `/admin*` (clear session + về login + toast, như MainActivity L408-422), link ngoài mở Safari; `didFinish` → inject `receipt-snapshot.js` + bridge script; `didFail` → màn lỗi "Không tải được Onesoft POS" + nút Thử lại; progress spinner; inject `--android-inset-*`/`--safe-*` từ `safeAreaInsets` (web `main.css` L60-63 đã consume sẵn).
- `AudioBridge` (qua `WKScriptMessageHandler`) — beep: WAV 2 tông 587/880Hz sinh runtime + AVAudioPlayer; speak: AVSpeechSynthesizer giọng vi-VN, split câu 3000 ký tự, queue như `NativeSpeaker.java`.
- `EscPosRaster.swift` — port nguyên encoder 26 dòng: `ESC @`, `ESC a 0`, `GS v 0` (threshold luminance <180, lát 128 hàng, chunk 4608 byte), kết thúc `ESC d 1` + `GS V 66 0` khi auto-cut.
- `PrinterNetworkAddress.swift` — port validate IPv4 (từ chối octet đầu 0/≥224, cuối 255).
- `ReceiptRenderer.swift` — offscreen WKWebView rộng 384/576px, chỉ cho `data:` + `https://img.vietqr.io`, chờ ảnh, chụp từng lát 128 hàng bằng `takeSnapshot(rect:)`, watchdog 20s, giới hạn 24000px.
- `ThermalPrinter.swift` — dispatcher: `lan`/`network` → `NWConnection` TCP 9100 (5s connect, 90s tổng, không retry job đã in — như `BluetoothPrintSession`); `browser` → render snapshot HTML thành ảnh rồi `UIPrintInteractionController` với khổ K58/K80/K85/A4; `bluetooth`/`usb`/`rawbt` → alert tiếng Việt hướng dẫn dùng LAN/Trình duyệt. Busy flag + worker đơn.
- `receipt-snapshot.js` — **copy nguyên văn** từ `android-pos/app/src/main/assets/`.

### 4. `.github/workflows/build-ipa.yml`
`workflow_dispatch` (bấm tay), runner `macos-15`: `xcodebuild archive` với `CODE_SIGNING_ALLOWED=NO` → đóng gói `Payload/OnesoftPOS.app` → zip `OnesoftPOS-1.0.0-unsigned.ipa` → upload artifact. Tách riêng, **không đụng workflow deploy.yml** (vẫn chỉ chạy khi push master).

### 5. `ios-pos/README.md`
Tiếng Việt: cách chạy workflow, tải .ipa, ký+cài bằng Sideloadly trên Windows, cách ký lại sau 7 ngày, ghi chú tải giọng đọc vi-VN (Cài đặt → Trợ năng → Nội dung đọc), in LAN port 9100.

## Thực hiện & kiểm chứng
1. Tạo toàn bộ file ở trên.
2. Git: tạo branch `build-ios-app` (không commit vào master), commit, push lên GitHub.
3. Trigger workflow (dùng `gh` CLI nếu máy đã đăng nhập, không thì hướng dẫn bạn bấm trong tab Actions), theo dõi log tới `BUILD SUCCEEDED`.
4. Tải artifact .ipa về máy, kiểm tra cấu trúc zip (`Payload/OnesoftPOS.app/...`).
5. Lưu ý: trên Windows không có Swift compiler cho iOS nên có thể phải **vài vòng sửa lỗi compile qua log Actions** — tôi sẽ tự lặp tới khi build thành công.
6. Bạn smoke test trên iPhone thật qua Sideloadly: mở app tải onesoft.one, beep/đọc số, in LAN, in browser, vào /admin bị đá về login, rút mạng → màn lỗi + Thử lại.