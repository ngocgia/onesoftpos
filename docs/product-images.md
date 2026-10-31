# Ảnh món ăn

Trong Admin → Sản phẩm, chọn cửa hàng rồi thêm hoặc sửa món. Chọn ảnh trong mục **Ảnh món ăn**, kiểm tra ảnh xem trước và bấm **Lưu**. Giao diện Quản trị bên trong POS cũng hỗ trợ thao tác này. Có thể dùng nút **Xóa ảnh** để trở lại emoji.

- File đầu vào: JPG, PNG hoặc WebP, tối đa 10 MB.
- Trình duyệt thu nhỏ cạnh dài còn tối đa 1200 px và chuyển sang JPEG, tối đa 1 MB trước khi tải lên.
- API `POST /api/product-images` nhận `{ "image": "data:image/jpeg;base64,..." }`, yêu cầu Bearer token và header `X-Store-Id`. Chỉ ADMIN, SUPER_ADMIN và STORE_MANAGER được phân công cửa hàng được tải ảnh.
- API trả `image_url` để lưu vào sản phẩm qua API tạo/sửa món. Các sản phẩm cũ dùng emoji hoặc URL ảnh vẫn hoạt động.
- Ảnh được lưu tại `server/data/product-images/<store_id>/` và phục vụ qua `/uploads/products/`. Có thể đặt `PRODUCT_IMAGE_STORAGE_DIR` thành đường dẫn tuyệt đối đến nơi lưu lâu dài. Sao lưu thư mục này cùng database; các lần triển khai code hiện tại giữ nguyên `server/data/`.
- Đổi hoặc xóa ảnh trên món không tự xóa file cũ, tránh ảnh đang được món khác sử dụng bị mất. Ảnh chỉ được tải lên khi bấm Lưu.

## Lưu ảnh mới trên Cloudflare R2

Tích hợp R2 cần Node.js 20 trở lên. Chạy `npm ci --prefix server` khi triển khai để cài SDK S3.
Trong `server/.env` hoặc biến môi trường của ứng dụng hosting, thiết lập:

```dotenv
PRODUCT_IMAGE_STORAGE=r2
R2_ENDPOINT=https://d538d84e1e03dfed50bc9e82c50f7149.r2.cloudflarestorage.com
R2_BUCKET=onesoft-products
R2_PUBLIC_URL=https://pub-a450347979424f79bf5ffdd39b4fd3d5.r2.dev
R2_ACCESS_KEY_ID=<Access Key ID>
R2_SECRET_ACCESS_KEY=<Secret Access Key>
```

Tạo thông tin S3 API trong Cloudflare R2 với quyền Object Read & Write, giới hạn bucket
`onesoft-products`. Điền khóa trực tiếp trên server, không đưa vào Git hoặc mã frontend.
Endpoint S3 không bao gồm `/onesoft-products`; tên bucket đã được cấu hình riêng.
Khởi động lại ứng dụng sau khi cập nhật biến môi trường.

Ảnh được tải qua API có kiểm tra đăng nhập/quyền hiện có; server gửi ảnh lên R2 với key
`products/<store_id>/<uuid>.<extension>` và trả URL công khai để lưu vào `image_url`.
Frontend tải ảnh trực tiếp từ URL này; không cần cấu hình CORS để upload vì upload từ server.
Nếu thiếu cấu hình hoặc R2 lỗi, API báo lỗi và không tự chuyển sang lưu local.
Giữ `PRODUCT_IMAGE_STORAGE=local` nếu chưa có khóa hoặc muốn tiếp tục lưu file trên server.

Ảnh cũ tại `/uploads/products/` tiếp tục hoạt động. Thay đổi này không chuyển hoặc xóa ảnh cũ;
giữ thư mục và bản sao lưu cho đến khi có bước di chuyển riêng, kiểm tra ảnh và cập nhật URL trong database.
File mới trên R2 dùng tên khác nhau để hỗ trợ cache dài hạn. Ảnh không còn được dùng chưa tự động xóa.

URL `r2.dev` dùng để thử nghiệm, bị giới hạn truy cập và không hỗ trợ cache CDN.
Khi chạy chính thức, gắn custom domain vào bucket và dùng domain đó cho `R2_PUBLIC_URL`.
Ảnh đã lưu trong database dùng URL đầy đủ, nên cần cập nhật các URL R2 cũ nếu đổi domain.
Xem [tài liệu public bucket](https://developers.cloudflare.com/r2/buckets/public-buckets/)
và [SDK S3 cho R2](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/).

Thực đơn sắp xếp tên món A–Z theo tiếng Việt, không phân biệt hoa thường. Món có tên bắt đầu bằng số được xếp sau toàn bộ món bắt đầu bằng chữ; trong nhóm số, 2 đứng trước 10. Số trong tên vẫn theo thứ tự tự nhiên (Bánh 2 đứng trước Bánh 10). Thứ tự được giữ khi lọc danh mục hoặc tìm kiếm.
