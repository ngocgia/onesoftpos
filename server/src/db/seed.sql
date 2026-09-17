-- ThichGaPOS v1.0 - Seed Data (PostgreSQL)

-- 1. STORE TYPES
INSERT INTO store_types (id, code, name, description, is_active) VALUES
(1, 'TAKEAWAY', 'Chỉ bán mang đi', 'Mô hình Kiot, Takeaway chuyên biệt, không có quản lý bàn', TRUE),
(2, 'DINE_IN_TAKEAWAY', 'Tại chỗ & Mang đi', 'Mô hình Nhà hàng/Quán ăn vừa phục vụ tại bàn vừa bán mang về', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. STORE TYPE FEATURES (Rule 40 & 46)
INSERT INTO store_type_features (store_type_id, feature_code, enabled) VALUES
-- TAKEAWAY Features
(1, 'SALE', TRUE),
(1, 'TAKEAWAY', TRUE),
(1, 'DINE_IN', FALSE),
(1, 'TABLE', FALSE),
(1, 'KDS', TRUE),
(1, 'INVOICE', TRUE),
(1, 'QR_PAYMENT', TRUE),
(1, 'INVENTORY', TRUE),

-- DINE_IN_TAKEAWAY Features
(2, 'SALE', TRUE),
(2, 'TAKEAWAY', TRUE),
(2, 'DINE_IN', TRUE),
(2, 'TABLE', TRUE),
(2, 'KDS', TRUE),
(2, 'INVOICE', TRUE),
(2, 'QR_PAYMENT', TRUE),
(2, 'INVENTORY', TRUE)
ON CONFLICT (store_type_id, feature_code) DO UPDATE SET enabled = EXCLUDED.enabled;

-- 3. STORES
INSERT INTO stores (id, code, name, display_name, store_type_id, phone, email, address, province, district, tax_code, logo_url, opening_time, closing_time, currency, status) VALUES
(1, 'STORE001', 'Thích Gà - Chi nhánh 1', 'Thích Gà - Quang Trung', 2, '0901234567', 'cn1@thichgapos.vn', '123 Quang Trung, Phường 10, Gò Vấp', 'Hồ Chí Minh', 'Gò Vấp', '0312345678', '🍗', '08:00', '22:30', 'VND', 'ACTIVE'),
(2, 'STORE002', 'Thích Gà Express - Kiot Nguyễn Huệ', 'Thích Gà Express', 1, '0909888999', 'express@thichgapos.vn', '88 Phố Đi Bộ Nguyễn Huệ, Bến Nghé', 'Hồ Chí Minh', 'Quận 1', '0312345678-001', '🍗', '09:00', '23:00', 'VND', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, store_type_id = EXCLUDED.store_type_id;

-- Reset serial sequence for stores if needed
SELECT setval(pg_get_serial_sequence('stores', 'id'), coalesce(max(id), 1)) FROM stores;

-- 4. STORE SETTINGS
INSERT INTO store_settings (store_id, allow_negative_stock, allow_discount, allow_custom_price, allow_cancel_item, allow_cancel_order, allow_refund, payment_cash, payment_transfer, payment_qr, payment_card, receipt_header, receipt_footer, receipt_paper_size, bank_name, bank_account_number, bank_account_holder, kds_enabled, workflow_definition) VALUES
(1, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 'HỆ THỐNG GÀ RÁN & TRÀ SỮA THÍCH GÀ', 'Cảm ơn Quý khách & Hẹn gặp lại!', '80mm', 'MB Bank', '090123456789', 'THICH GA POS CN1', TRUE, '{"name":"Thu ngân - Bếp - Thanh toán","steps":[{"id":"create","name":"Thu ngân tạo đơn","type":"CREATE","roles":["CASHIER"]},{"id":"kitchen","name":"Bếp chế biến","type":"KITCHEN","roles":["KITCHEN"]},{"id":"payment","name":"Thu ngân thanh toán","type":"PAYMENT","roles":["CASHIER"]}]}'::jsonb),
(2, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 'THÍCH GÀ EXPRESS - MANG ĐI SIÊU TỐC', 'Chúc Quý khách ngon miệng!', '58mm', 'MB Bank', '090988899999', 'THICH GA EXPRESS', TRUE, '{"name":"Thu ngân - Bếp - Thanh toán","steps":[{"id":"create","name":"Thu ngân tạo đơn","type":"CREATE","roles":["CASHIER"]},{"id":"kitchen","name":"Bếp chế biến","type":"KITCHEN","roles":["KITCHEN"]},{"id":"payment","name":"Thu ngân thanh toán","type":"PAYMENT","roles":["CASHIER"]}]}'::jsonb)
ON CONFLICT (store_id) DO NOTHING;

-- 5. USERS (Mật khẩu mặc định: 123456)
-- Hash của '123456': $2a$10$6l5B4rZf2hF27nffgRj27eX7E2bX8cMvO1o1bNfTskwWwNnNrmPae
INSERT INTO users (id, username, email, password_hash, full_name, phone, role, status) VALUES
(1, 'admin', 'admin@thichgapos.com', '$2a$10$wO0/s6vE2s.jI4dEfevNdu5lE8pG5eZ.pZ3X6r7F0K1x7aU8s02e.', 'Quản trị viên Hệ Thống', '0900000001', 'SUPER_ADMIN', 'ACTIVE'),
(2, 'manager', 'manager@thichgapos.com', '$2a$10$wO0/s6vE2s.jI4dEfevNdu5lE8pG5eZ.pZ3X6r7F0K1x7aU8s02e.', 'Nguyễn Quản Lý', '0900000002', 'STORE_MANAGER', 'ACTIVE'),
(3, 'cashier', 'cashier@thichgapos.com', '$2a$10$wO0/s6vE2s.jI4dEfevNdu5lE8pG5eZ.pZ3X6r7F0K1x7aU8s02e.', 'Trần Thu Ngân', '0900000003', 'CASHIER', 'ACTIVE'),
(4, 'kitchen', 'kitchen@thichgapos.com', '$2a$10$wO0/s6vE2s.jI4dEfevNdu5lE8pG5eZ.pZ3X6r7F0K1x7aU8s02e.', 'Lê Đầu Bếp', '0900000004', 'KITCHEN', 'ACTIVE'),
(5, 'order', 'order@thichgapos.com', '$2a$10$wO0/s6vE2s.jI4dEfevNdu5lE8pG5eZ.pZ3X6r7F0K1x7aU8s02e.', 'Phạm Nhân Viên Order', '0900000005', 'ORDER_STAFF', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1)) FROM users;

-- 6. USER STORES (Phân quyền truy cập cửa hàng)
INSERT INTO user_stores (user_id, store_id, is_default) VALUES
(1, 1, TRUE),
(1, 2, FALSE),
(2, 1, TRUE),
(2, 2, FALSE),
(3, 1, TRUE),
(4, 1, TRUE),
(5, 1, TRUE)
ON CONFLICT (user_id, store_id) DO NOTHING;

-- 6.1 ROLE FEATURES (visibility and access by user group)
INSERT INTO role_features (role, feature_code, enabled) VALUES
('ADMIN', 'POS', TRUE), ('ADMIN', 'TABLES', TRUE), ('ADMIN', 'KDS', TRUE), ('ADMIN', 'ORDERS', TRUE), ('ADMIN', 'ADMIN', TRUE), ('ADMIN', 'SHIFT', TRUE), ('ADMIN', 'DISCOUNT', TRUE),
('STORE_MANAGER', 'POS', TRUE), ('STORE_MANAGER', 'TABLES', TRUE), ('STORE_MANAGER', 'KDS', TRUE), ('STORE_MANAGER', 'ORDERS', TRUE), ('STORE_MANAGER', 'ADMIN', TRUE), ('STORE_MANAGER', 'SHIFT', TRUE), ('STORE_MANAGER', 'DISCOUNT', TRUE),
('ORDER_STAFF', 'POS', TRUE), ('ORDER_STAFF', 'TABLES', TRUE), ('ORDER_STAFF', 'KDS', FALSE), ('ORDER_STAFF', 'ORDERS', TRUE), ('ORDER_STAFF', 'PAYMENT', FALSE), ('ORDER_STAFF', 'ADMIN', FALSE), ('ORDER_STAFF', 'SHIFT', FALSE), ('ORDER_STAFF', 'DISCOUNT', FALSE),
('ADMIN', 'PAYMENT', TRUE), ('STORE_MANAGER', 'PAYMENT', TRUE),
('CASHIER', 'POS', TRUE), ('CASHIER', 'TABLES', TRUE), ('CASHIER', 'KDS', FALSE), ('CASHIER', 'ORDERS', TRUE), ('CASHIER', 'ADMIN', FALSE), ('CASHIER', 'SHIFT', TRUE), ('CASHIER', 'DISCOUNT', TRUE),
('CASHIER', 'PAYMENT', TRUE),
('KITCHEN', 'POS', FALSE), ('KITCHEN', 'TABLES', FALSE), ('KITCHEN', 'KDS', TRUE), ('KITCHEN', 'ORDERS', FALSE), ('KITCHEN', 'ADMIN', FALSE), ('KITCHEN', 'SHIFT', FALSE), ('KITCHEN', 'DISCOUNT', FALSE),
('KITCHEN', 'PAYMENT', FALSE)
ON CONFLICT (role, feature_code) DO UPDATE SET enabled = EXCLUDED.enabled;

-- 7. CATEGORIES
INSERT INTO categories (id, store_id, code, name, description, sort_order) VALUES
(1, 1, 'GA', 'Gà Rán & Cơm Gà', 'Các món gà rán thơm giòn vàng rụm', 1),
(2, 1, 'NUOC', 'Trà Sữa & Đồ Uống', 'Trà sữa đậm vị, cà phê và nước ép tươi', 2),
(3, 1, 'ANVAT', 'Món Ăn Kèm', 'Khoai tây, xúc xích và món vặt', 3),
(4, 2, 'GA_EXP', 'Gà Rán Mang Đi', 'Gà rán phục vụ nhanh mang đi', 1),
(5, 2, 'NUOC_EXP', 'Trà & Nước Uống Mang Đi', 'Đồ uống ly nắp cầu tiện lợi', 2)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval(pg_get_serial_sequence('categories', 'id'), coalesce(max(id), 1)) FROM categories;

-- 8. PRODUCTS
INSERT INTO products (id, store_id, category_id, code, name, description, price, cost_price, unit, image_url, kitchen_type, is_active) VALUES
(1, 1, 1, 'GA01', 'Gà Rán Giòn Cay', 'Miếng gà rán tẩm bột giòn tan, vị cay vừa miệng', 35000, 18000, 'Miếng', '🍗', 'KITCHEN', TRUE),
(2, 1, 1, 'GA02', 'Cơm Gà Xối Mỡ Mắm Tỏi', 'Cơm vàng dẻo ăn kèm đùi gà góc tư sốt nước mắm tỏi ớt', 45000, 22000, 'Dĩa', '🍚', 'KITCHEN', TRUE),
(3, 1, 1, 'GA03', 'Đùi Gà Sốt Cay Hàn Quốc', 'Đùi gà giòn quyện sốt cay ngọt kiểu Hàn chuẩn vị', 40000, 20000, 'Cái', '🍗', 'KITCHEN', TRUE),
(4, 1, 2, 'TS01', 'Trà Sữa Trân Châu Đường Đen', 'Trà sữa Đài Loan thơm béo kèm trân châu nấu đường đen', 30000, 10000, 'Ly', '🧋', 'BAR', TRUE),
(5, 1, 2, 'TS02', 'Trà Đào Cam Sả', 'Trà thảo mộc thanh mát với đào miếng giòn ngọt', 28000, 9000, 'Ly', '🍹', 'BAR', TRUE),
(6, 1, 2, 'CF01', 'Cà Phê Sữa Đá Sài Gòn', 'Cà phê Robusta pha phin đậm đà thơm ngậy sữa đặc', 22000, 7000, 'Ly', '☕', 'BAR', TRUE),
(7, 1, 3, 'AV01', 'Khoai Tây Chiên Lắc Phô Mai', 'Khoai tây cọng giòn rụm phủ lớp bột phô mai béo thơm', 25000, 11000, 'Phần', '🍟', 'KITCHEN', TRUE),
(8, 2, 4, 'EXP01', 'Combo Gà Rán + Pepsi Mang Đi', '1 miếng gà rán giòn cay + 1 lon Pepsi mát lạnh', 45000, 22000, 'Combo', '🍗', 'KITCHEN', TRUE),
(9, 2, 5, 'EXP02', 'Trà Sữa Trân Châu Mang Đi', 'Trà sữa ly lớn 700ml trân châu sẵn sàng mang đi', 32000, 11000, 'Ly', '🧋', 'BAR', TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price;

SELECT setval(pg_get_serial_sequence('products', 'id'), coalesce(max(id), 1)) FROM products;

-- 9. PRODUCT VARIANTS (Size)
INSERT INTO product_variants (product_id, size_name, price_adjustment, is_default) VALUES
(4, 'Size M', 0, TRUE),
(4, 'Size L (+6k)', 6000, FALSE),
(5, 'Size M', 0, TRUE),
(5, 'Size L (+5k)', 5000, FALSE),
(6, 'Ly Tiêu Chuẩn', 0, TRUE)
ON CONFLICT DO NOTHING;

-- 10. PRODUCT OPTIONS (Toppings)
INSERT INTO product_options (store_id, name, price, is_active) VALUES
(1, 'Trân châu đen', 5000, TRUE),
(1, 'Kem Cheese Macchiato', 10000, TRUE),
(1, 'Thạch dừa non', 5000, TRUE),
(1, 'Thêm 1 Trứng ốp la', 7000, TRUE),
(1, 'Thêm Cơm trắng xối mỡ', 5000, TRUE),
(2, 'Thêm Trân châu', 5000, TRUE)
ON CONFLICT DO NOTHING;

-- 11. AREAS & TABLES (FOR STORE001 DINE-IN)
INSERT INTO areas (id, store_id, name, sort_order, is_active) VALUES
(1, 1, 'Tầng 1 - Phòng Máy Lạnh', 1, TRUE),
(2, 1, 'Tầng 2 - View Sân Vườn', 2, TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval(pg_get_serial_sequence('areas', 'id'), coalesce(max(id), 1)) FROM areas;

INSERT INTO tables (id, store_id, area_id, code, name, seats, status, sort_order) VALUES
(1, 1, 1, 'B01', 'Bàn 01', 4, 'EMPTY', 1),
(2, 1, 1, 'B02', 'Bàn 02', 4, 'EMPTY', 2),
(3, 1, 1, 'B03', 'Bàn 03', 2, 'EMPTY', 3),
(4, 1, 1, 'B04', 'Bàn 04', 6, 'EMPTY', 4),
(5, 1, 2, 'B05', 'Bàn 05 (VIP)', 8, 'EMPTY', 5),
(6, 1, 2, 'B06', 'Bàn 06', 4, 'EMPTY', 6),
(7, 1, 2, 'B07', 'Bàn 07', 4, 'EMPTY', 7)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

SELECT setval(pg_get_serial_sequence('tables', 'id'), coalesce(max(id), 1)) FROM tables;
