# Rà soát tính năng OnesoftPOS — 09/10/2026

## Phạm vi và giới hạn

Đối chiếu màn hình public/index.html, các module public/js, trang quản trị riêng, router API, middleware quyền và các controller liên quan. Đây là rà soát mã nguồn và cấu trúc chức năng; chưa chạy kiểm thử đầu cuối trên trình duyệt, cơ sở dữ liệu thật, thiết bị in hay dịch vụ thanh toán. Không thay đổi hành vi ứng dụng trong lần rà soát này. APK Android chưa được kiểm thử.

`npm test --prefix server`: 8/8 đạt. Các bài kiểm thử hiện có tập trung vào chuyển đổi truy vấn/schema MySQL, không bao phủ nghiệp vụ POS.

## Danh mục chức năng

| Nhóm | Chức năng đã thấy trong mã | Đánh giá |
|---|---|---|
| Bán hàng | Tìm/lọc món, danh mục, size/topping, số lượng, giỏ hàng, giảm giá, ghi chú | Có luồng frontend/backend; cần kiểm thử giá và quyền thực tế |
| Mang đi | Nhiều đơn nháp, khách mới, giao hàng/khách lấy/app, thông tin khách và giờ hẹn | Có xử lý; cần phân biệt đơn nháp với đơn đã tạo |
| Phòng bàn | Sơ đồ, trạng thái, chọn bàn, chi tiết món, hủy món, chuyển/ghép bàn, CRUD khu vực/bàn | CRUD xuất hiện ở nhiều vị trí |
| Bếp | Bộ lọc bếp/pha chế, trạng thái món, hủy món, đọc thông báo, lịch sử bếp | Có luồng riêng phù hợp vai trò |
| Phục vụ | Món đã xong thuộc đơn chưa thanh toán | Có màn hình riêng; chưa thấy thao tác xác nhận đã phục vụ trong module này |
| Đơn hàng | Lọc/lịch sử, chi tiết, hoàn tất bước, in lại, thanh toán, thanh toán lại | Màn hình đang trộn điều hành và lịch sử |
| Thanh toán | Tiền mặt, QR, chuyển khoản, thẻ; tiền nhận/thối; thay thế giao dịch | Có API; không suy ra đã tích hợp ngân hàng hoặc máy POS thẻ chỉ từ tên phương thức |
| Biên lai | Phiếu tạm, phiếu thanh toán, in lại, in qua trình duyệt | Đã dùng chung invoiceModule; cài đặt máy in chưa nối vào luồng này |
| Ca | Xem ca, mở ca, đóng ca | Có frontend/API; cần kiểm thử đối soát thực tế |
| Quản trị cửa hàng | Doanh thu, thực đơn, size/topping, thông tin cửa hàng/ngân hàng/biên lai, luồng, nhân viên/quyền | Một phần nghiệp vụ lặp với trang quản trị hệ thống |
| Kho | Danh mục nguyên vật liệu, tổng hợp tồn, nhập/xuất/điều chỉnh, lịch sử, báo cáo | Có frontend/API; triển khai UI lặp giữa hai trang quản trị |
| Hệ thống | Cửa hàng/loại cửa hàng, người dùng, quyền, nhật ký | Trang quản trị riêng có chức năng thật; POS có mục nhật ký dùng dữ liệu mẫu khi API lỗi |
| Tiện ích | Máy in, quy trình, vận chuyển, số, HĐĐT, website/QR menu, tích điểm, loa | Nhiều mục mới là giao diện hoặc chỉ lưu cục bộ |
| Tài khoản | Thông tin, giao diện header, đổi mật khẩu, xóa tài khoản, đăng xuất | Đổi mật khẩu/xóa tài khoản chưa có xử lý API tương ứng trong module menu |

## Các phần trùng hoặc chồng chéo và phương án

| Mức | Vị trí | Bằng chứng | Phương án |
|---|---|---|---|
| P1 | Quy trình bán hàng và Luồng & Phân quyền | more-menu.js:273–293 đọc feature rồi chỉ đóng modal/thông báo lưu; admin.js:140 lưu workflow_definition qua API | Gộp thành một màn Cài đặt → Quy trình. Tách mục Kênh bán khỏi Các bước xử lý và Quyền nhân viên. Dùng cùng API/store settings, tải lại sau lưu |
| P1 | Loa thông báo trong POS và cấu hình thông báo KDS | more-menu.js:408–480 lưu pos_speaker_settings; kds.js:46–60 đọc loa với volume=1, không dùng khóa này; admin-page.js:628 cấu hình thông báo cửa hàng | Một dịch vụ âm thanh dùng chung. Mẫu câu theo cửa hàng; bật/tắt và âm lượng theo thiết bị. Mọi nơi phát âm thanh đều đọc cấu hình này |
| P2 | Quản lý phòng bàn trên sơ đồ, trong Nhiều hơn, và admin riêng | tables.js:172–245 quản lý khu vực/bàn và renderAdminManagement; admin-page.js:1194,1240 có editor riêng | Sơ đồ chỉ tập trung thao tác phục vụ; CRUD đặt tại Cài đặt → Phòng bàn. Nút quản lý trên sơ đồ là lối tắt đến cùng màn hình/editor |
| P2 | Chọn cửa hàng ở header và Danh sách cửa hàng | app.js:178–215 và more-menu.js:532–591 đều chuyển cửa hàng; admin.js:76 quản lý cửa hàng | Giữ một bộ chọn ở header; “Danh sách cửa hàng” chuyển thành “Thông tin cửa hàng” cho quản lý. Dùng chung hàm chuyển store, xử lý đơn nháp trước khi đổi |
| P2 | Lối tắt quản trị và thanh tab quản trị | index.html:425–449 và :619 trở đi; more-menu.js:107–137; admin.js:35 | Lối tắt không phải nghiệp vụ lặp, có thể giữ. Gộp code điều hướng/tải dữ liệu thành một hàm; áp cùng quy tắc quyền và admin_tabs |
| P2 | Thực đơn, topping/size, kho, phòng bàn trên POS và admin riêng | admin.js và admin-page.js đều có editor, tải và render các nhóm này | Giữ phạm vi: quản lý chi nhánh thao tác cửa hàng mình, admin thao tác toàn hệ thống. Dùng chung service/form/validation để tránh sửa một nơi lệch nơi khác |
| P2 | “Lịch sử đơn hàng” chứa cả đơn đang xử lý | orders.js:110–240 có hoàn tất bước/thanh toán bên trong lịch sử | Đổi thành “Đơn hàng”, có tab “Đang xử lý” và “Lịch sử”. Tab lịch sử chỉ chi tiết/in lại và quyền sửa giao dịch riêng |
| P2 | Thông tin tài khoản ở avatar và Nhiều hơn | more-menu.js:627 và header-customizer.js:378 trở đi mở cùng modal | Giữ avatar là điểm truy cập chính; mục menu là lối tắt nếu cần. Phân biệt thông tin tài khoản với tùy chỉnh giao diện thiết bị |

P1: ảnh hưởng tính đúng đắn hoặc gây hiểu sai kết quả. P2: cải thiện cấu trúc, bảo trì và thao tác.

## Những phần không nên gộp chỉ vì cùng dữ liệu

- KDS phục vụ bếp, Món đã xong phục vụ nhân viên mang món. Giữ hai góc nhìn theo vai trò; cân nhắc bổ sung trạng thái Đã phục vụ để món không nằm chờ đến lúc thanh toán.
- Đơn nháp mang đi là giỏ đang nhập; Đơn hàng là đơn đã tạo trên server. Đổi tên tab nháp thành “Đơn đang nhập” để giảm nhầm lẫn.
- In phiếu tạm, in phiếu thanh toán và in lại là các thời điểm khác nhau; tiếp tục dùng chung invoiceModule, đặt nhãn rõ “In tạm tính” và “In lại biên lai”.
- Thanh toán từ giỏ, bàn hoặc danh sách đơn là lối tắt hợp lý nếu cùng mở checkoutModule với cùng ID đơn. “Thanh toán lại” là sửa giao dịch, nên nằm trong chi tiết đơn với quyền và lý do riêng.
- Giảm giá đơn hiện tại và chương trình tích điểm/khuyến mãi là hai nghiệp vụ khác nhau. Khi triển khai khuyến mãi thật, cần chung bộ tính tiền và quy tắc cộng dồn.
- Báo cáo doanh thu, báo cáo kho và nhật ký thao tác trả lời các câu hỏi khác nhau, không gộp dữ liệu thành một danh sách chung.

## Vấn đề cần sửa trước khi tinh giản menu

1. **Đổi mật khẩu báo thành công nhưng không đổi**: more-menu.js:604–624 chỉ kiểm tra đầu vào rồi toast. Bổ sung API đổi mật khẩu đã xác thực, kiểm tra mật khẩu cũ, xử lý phiên và chỉ báo thành công sau khi server xác nhận.
2. **Yêu cầu xóa tài khoản không được gửi**: more-menu.js:654 chỉ hiện thông báo. Triển khai bản ghi yêu cầu và trạng thái xử lý, hoặc ẩn chức năng cho đến khi có backend.
3. **Nhật ký giả khi lỗi/không đủ quyền**: more-menu.js:499–510 tạo LOGIN/OPEN_SHIFT/CREATE/UPDATE mẫu khi gọi API thất bại. Bỏ fallback mẫu; phân biệt lỗi quyền, lỗi tải và danh sách trống. Chỉ hiện dữ liệu thực.
4. **Các nút lưu chưa lưu**: saveWorkflowSettings, saveShippingSettings, saveEInvoiceSettings, saveLoyaltySettings chỉ đóng modal/thông báo. Ẩn/đánh dấu Chưa triển khai; hoặc hoàn thiện lưu, tải lại và nối vào nghiệp vụ.
5. **Kiểm tra HĐĐT báo kết nối thành công giả lập**: more-menu.js:351–356 dùng setTimeout, không gọi nhà cung cấp. Chỉ báo kết quả từ yêu cầu kiểm tra thật.
6. **Cấu hình máy in chưa áp dụng khi in thật**: pos_printer_settings chỉ được đọc/ghi trong more-menu.js; invoice.js:28 gọi window.print(). Đồng bộ khổ giấy và tự in với luồng biên lai; chỉ hiển thị IP/cắt giấy nếu có adapter thiết bị hỗ trợ.
7. **Định dạng số chỉ đổi màn xem trước**: pos_number_format chưa được api.formatMoney sử dụng; api.js:97 vẫn định dạng VND cố định. Dùng một formatter. Nếu làm tròn làm thay đổi tiền thu, tính ở backend và lưu vào giao dịch; không chỉ làm tròn phần hiển thị.
8. **Website/QR menu chưa có luồng menu công khai tương ứng**: more-menu.js:369 tạo URL mode=menu, nhưng app.js chỉ kiểm tra mode=pos khi định tuyến admin; chưa thấy xử lý menu công khai. Tạo trang menu chỉ đọc đúng cửa hàng và quyền truy cập riêng trước khi quảng bá QR.
9. **Lối tắt chưa đồng bộ quyền**: more-menu.js:79 chỉ bật cả nhóm theo vai trò; openAdminSubview không kiểm tra từng mục, trong khi state.js:171 có admin_tabs và quyền riêng. Dùng chung predicate cho tab, lối tắt và điều hướng; quyền API vẫn phải độc lập. Ví dụ ADMIN có thể thấy lối tắt Nhân viên nhưng /store/staff dành cho STORE_MANAGER và SUPER_ADMIN được bypass.
10. **Báo cáo doanh thu thiếu gate quyền chuyên biệt ở route**: /reports/summary chỉ authenticateToken trong routes/api.js. Middleware đã kiểm tra quyền vào cửa hàng khi có store context, nhưng chưa có quyền xem báo cáo riêng. Bổ sung quyền REPORTS và bắt buộc store context theo phạm vi; kiểm thử nhân viên không có quyền không đọc được doanh thu.

## Cấu trúc giao diện đề xuất

Điều hướng POS: Bán hàng · Bàn (nếu tại chỗ) · Đơn hàng · Món sẵn sàng (theo quyền) · Nhiều hơn. KDS có bố cục riêng cho vai trò bếp.

Nhiều hơn:
- Quản lý kinh doanh: Doanh thu, Thực đơn, Kho, Nhân viên.
- Cài đặt cửa hàng: Thông tin cửa hàng, Kênh bán & Quy trình, Phòng bàn, Thanh toán, Biên lai, Quyền nhân viên.
- Thiết bị: Máy in, Âm thanh, Hiển thị số và giao diện.
- Tài khoản: Thông tin, Đổi mật khẩu, Đăng xuất. Chỉ thêm yêu cầu xóa khi đã có quy trình thật.
- Tích hợp: vận chuyển, HĐĐT, website, loyalty chỉ xuất hiện khi đã triển khai và được bật.

Quản trị hệ thống giữ quản lý nhiều cửa hàng, loại cửa hàng, tài khoản toàn hệ thống, quyền mặc định và nhật ký hệ thống. Phân quyền toàn hệ thống, theo cửa hàng và ngoại lệ từng tài khoản cần có thứ tự ưu tiên được định nghĩa rõ, hiển thị nguồn quyền hiệu lực.

## Lộ trình và tiêu chí nghiệm thu

1. Sửa các thông báo thành công không có kết quả thật, bỏ nhật ký mẫu, khóa các tích hợp chưa triển khai và đồng bộ quyền lối tắt/API.
2. Gộp cấu hình quy trình, chuyển CRUD bàn về một màn, dùng chung hàm đổi cửa hàng và điều hướng quản trị; tách đơn đang xử lý/lịch sử.
3. Nối máy in/âm thanh/formatter vào luồng vận hành; tách cấu hình cửa hàng và cấu hình thiết bị; dùng chung module quản trị giữa hai trang.
4. Kiểm thử đầu cuối theo SUPER_ADMIN, ADMIN, STORE_MANAGER, CASHIER, ORDER_STAFF, KITCHEN; tại chỗ và mang đi; ít nhất hai cửa hàng. Xác nhận cấu hình tồn tại sau tải lại, đổi cửa hàng không mang nhầm giỏ/quyền/cài đặt, đơn không tạo lặp khi thử lại thanh toán, chuyển/ghép bàn đúng, món hủy không tính tiền/in bill, thanh toán lại đối soát đúng ca và báo cáo, trạng thái món nhất quán giữa bếp/phục vụ/đơn hàng.

Chỉ công bố đã kiểm thử toàn bộ sau khi có kết quả các kịch bản trên. Các API có sẵn như tách đơn và các trạng thái như đặt trước cũng cần kiểm tra mức hoàn thiện giao diện trước khi coi là tính năng đã nghiệm thu.
