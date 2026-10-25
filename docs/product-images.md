# Ảnh món ăn

Trong Admin → Sản phẩm, chọn cửa hàng rồi thêm hoặc sửa món. Chọn ảnh trong mục **Ảnh món ăn**, kiểm tra ảnh xem trước và bấm **Lưu**. Giao diện Quản trị bên trong POS cũng hỗ trợ thao tác này. Có thể dùng nút **Xóa ảnh** để trở lại emoji.

- File đầu vào: JPG, PNG hoặc WebP, tối đa 10 MB.
- Trình duyệt thu nhỏ cạnh dài còn tối đa 1200 px và chuyển sang JPEG, tối đa 1 MB trước khi tải lên.
- API `POST /api/product-images` nhận `{ "image": "data:image/jpeg;base64,..." }`, yêu cầu Bearer token và header `X-Store-Id`. Chỉ ADMIN, SUPER_ADMIN và STORE_MANAGER được phân công cửa hàng được tải ảnh.
- API trả `image_url` để lưu vào sản phẩm qua API tạo/sửa món. Các sản phẩm cũ dùng emoji hoặc URL ảnh vẫn hoạt động.
- Ảnh được lưu tại `server/data/product-images/<store_id>/` và phục vụ qua `/uploads/products/`. Có thể đặt `PRODUCT_IMAGE_STORAGE_DIR` thành đường dẫn tuyệt đối đến nơi lưu lâu dài. Sao lưu thư mục này cùng database; các lần triển khai code hiện tại giữ nguyên `server/data/`.
- Đổi hoặc xóa ảnh trên món không tự xóa file cũ, tránh ảnh đang được món khác sử dụng bị mất. Ảnh chỉ được tải lên khi bấm Lưu.

Thực đơn sắp xếp tên món A–Z theo tiếng Việt, không phân biệt hoa thường, xử lý số tự nhiên (Bánh 2 đứng trước Bánh 10). Thứ tự được giữ khi lọc danh mục hoặc tìm kiếm.
