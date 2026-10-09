-- Import this into an EMPTY MySQL 8 database using phpMyAdmin.
-- Sample accounts are created with the password from seed.sql; change them before production use.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS store_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_type_features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_type_id INT,
    feature_code VARCHAR(50) NOT NULL,
    enabled TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_type_id, feature_code),
    FOREIGN KEY (store_type_id) REFERENCES store_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    display_name VARCHAR(150),
    store_type_id INT,
    phone VARCHAR(20),
    email VARCHAR(100),
    address VARCHAR(255),
    province VARCHAR(100),
    district VARCHAR(100),
    ward VARCHAR(100),
    tax_code VARCHAR(50),
    logo_url TEXT,
    opening_time VARCHAR(10) DEFAULT '08:00',
    closing_time VARCHAR(10) DEFAULT '22:00',
    currency VARCHAR(10) DEFAULT 'VND',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_type_id) REFERENCES store_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT UNIQUE,
    allow_negative_stock TINYINT(1) DEFAULT 0,
    allow_discount TINYINT(1) DEFAULT 1,
    allow_custom_price TINYINT(1) DEFAULT 0,
    allow_cancel_item TINYINT(1) DEFAULT 1,
    allow_cancel_order TINYINT(1) DEFAULT 1,
    allow_refund TINYINT(1) DEFAULT 1,
    payment_cash TINYINT(1) DEFAULT 1,
    payment_transfer TINYINT(1) DEFAULT 1,
    payment_qr TINYINT(1) DEFAULT 1,
    payment_card TINYINT(1) DEFAULT 1,
    receipt_header TEXT,
    receipt_footer TEXT,
    receipt_paper_size VARCHAR(10) DEFAULT '80mm',
    bank_name VARCHAR(100) DEFAULT 'MB Bank',
    bank_account_number VARCHAR(50) DEFAULT '9999988888',
    bank_account_holder VARCHAR(100) DEFAULT 'THICHGAPOS STORE',
    kds_enabled TINYINT(1) DEFAULT 1,
    kds_auto_print TINYINT(1) DEFAULT 0,
    kds_completion_message TEXT DEFAULT ('Món ăn {mon}, bàn {ban} đã xong'),
    takeaway_workspace_enabled TINYINT(1) DEFAULT NULL,
    workflow_definition JSON DEFAULT ('{"name":"Thu ngân - Bếp - Thanh toán","steps":[{"id":"create","name":"Thu ngân tạo đơn","type":"CREATE","roles":["CASHIER"]},{"id":"kitchen","name":"Bếp chế biến","type":"KITCHEN","roles":["KITCHEN"]},{"id":"payment","name":"Thu ngân thanh toán","type":"PAYMENT","roles":["CASHIER"]}]}'),
    admin_tabs JSON DEFAULT NULL,
    inventory_transactions_enabled TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(30) NOT NULL DEFAULT 'CASHIER',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    completed_items_enabled TINYINT(1) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_stores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    store_id INT,
    is_default TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, store_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_features (
    role VARCHAR(30) NOT NULL,
    feature_code VARCHAR(50) NOT NULL,
    enabled TINYINT(1) DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role, feature_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_role_features (
    store_id INT,
    role VARCHAR(30) NOT NULL,
    feature_code VARCHAR(50) NOT NULL,
    enabled TINYINT(1) DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (store_id, role, feature_code),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    code VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sizes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, name),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    category_id INT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cost_price NUMERIC(15, 2) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'Phần',
    image_url TEXT,
    kitchen_type VARCHAR(20) DEFAULT 'KITCHEN',
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, code),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    size_name VARCHAR(50) NOT NULL,
    price_adjustment NUMERIC(15, 2) DEFAULT 0,
    is_default TINYINT(1) DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS topping_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    UNIQUE(store_id, name),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    group_id INT,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES topping_groups(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_option_products (
    option_id INT,
    product_id INT,
    PRIMARY KEY (option_id, product_id),
    FOREIGN KEY (option_id) REFERENCES product_options(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    area_id INT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    seats INT DEFAULT 4,
    status VARCHAR(20) DEFAULT 'EMPTY',
    current_order_id INT,
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, code),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    user_id INT,
    opening_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    closing_time DATETIME,
    opening_cash NUMERIC(15, 2) DEFAULT 0,
    closing_cash NUMERIC(15, 2) DEFAULT 0,
    expected_cash NUMERIC(15, 2) DEFAULT 0,
    difference NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'OPEN',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_code VARCHAR(50) UNIQUE NOT NULL,
    store_id INT,
    shift_id INT,
    order_type VARCHAR(20) NOT NULL DEFAULT 'TAKEAWAY',
    order_source VARCHAR(20) DEFAULT 'POS',
    fulfillment_type VARCHAR(30),
    table_id INT,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    delivery_address TEXT,
    scheduled_at DATETIME,
    cashier_id INT,
    confirmed_by INT,
    confirmed_at DATETIME,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15, 2) DEFAULT 0,
    tax_amount NUMERIC(15, 2) DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'UNPAID',
    order_status VARCHAR(20) DEFAULT 'CONFIRMED',
    workflow_stage_index INT DEFAULT 0,
    workflow_snapshot JSON,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL,
    FOREIGN KEY (cashier_id) REFERENCES users(id),
    FOREIGN KEY (confirmed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT,
    variant_id INT,
    product_name VARCHAR(150) NOT NULL,
    variant_name VARCHAR(50),
    unit_price NUMERIC(15, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal NUMERIC(15, 2) NOT NULL,
    note TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    kitchen_type VARCHAR(20) DEFAULT 'KITCHEN',
    prepared_by INT,
    prepared_at DATETIME,
    cancelled_by INT,
    cancelled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
    FOREIGN KEY (prepared_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_item_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_item_id INT,
    option_id INT,
    option_name VARCHAR(100) NOT NULL,
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES product_options(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    store_id INT,
    payment_method VARCHAR(30) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    cash_received NUMERIC(15, 2) DEFAULT 0,
    cash_return NUMERIC(15, 2) DEFAULT 0,
    transaction_code VARCHAR(100),
    status VARCHAR(20) DEFAULT 'SUCCESS',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    old_value JSON,
    new_value JSON,
    details TEXT,
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) DEFAULT 'Nguyên liệu',
    unit VARCHAR(30) NOT NULL DEFAULT 'kg',
    cost_price NUMERIC(15, 2) DEFAULT 0,
    current_stock NUMERIC(15, 3) DEFAULT 0,
    min_stock NUMERIC(15, 3) DEFAULT 5,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, code),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_code VARCHAR(50) NOT NULL,
    store_id INT,
    item_id INT,
    transaction_type VARCHAR(20) NOT NULL,
    quantity NUMERIC(15, 3) NOT NULL,
    price NUMERIC(15, 2) DEFAULT 0,
    total_amount NUMERIC(15, 2) DEFAULT 0,
    stock_before NUMERIC(15, 3) DEFAULT 0,
    stock_after NUMERIC(15, 3) DEFAULT 0,
    user_id INT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_preferences (
    owner_type VARCHAR(10) NOT NULL,
    owner_id INTEGER NOT NULL,
    section VARCHAR(32) NOT NULL,
    payload TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_type, owner_id, section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO store_types (id, code, name, description, is_active) VALUES
(1, 'TAKEAWAY', 'Chỉ bán mang đi', 'Mô hình Kiot, Takeaway chuyên biệt, không có quản lý bàn', TRUE),
(2, 'DINE_IN_TAKEAWAY', 'Tại chỗ & Mang đi', 'Mô hình Nhà hàng/Quán ăn vừa phục vụ tại bàn vừa bán mang về', TRUE);

INSERT INTO store_type_features (store_type_id, feature_code, enabled) VALUES

(1, 'SALE', TRUE),
(1, 'TAKEAWAY', TRUE),
(1, 'DINE_IN', FALSE),
(1, 'TABLE', FALSE),
(1, 'KDS', TRUE),
(1, 'INVOICE', TRUE),
(1, 'QR_PAYMENT', TRUE),
(1, 'INVENTORY', TRUE),


(2, 'SALE', TRUE),
(2, 'TAKEAWAY', TRUE),
(2, 'DINE_IN', TRUE),
(2, 'TABLE', TRUE),
(2, 'KDS', TRUE),
(2, 'INVOICE', TRUE),
(2, 'QR_PAYMENT', TRUE),
(2, 'INVENTORY', TRUE);

INSERT INTO stores (id, code, name, display_name, store_type_id, phone, email, address, province, district, tax_code, logo_url, opening_time, closing_time, currency, status) VALUES
(1, 'STORE001', 'Thích Gà - Chi nhánh 1', 'Thích Gà - Quang Trung', 2, '0901234567', 'cn1@thichgapos.vn', '123 Quang Trung, Phường 10, Gò Vấp', 'Hồ Chí Minh', 'Gò Vấp', '0312345678', '🍗', '08:00', '22:30', 'VND', 'ACTIVE'),
(2, 'STORE002', 'Thích Gà Express - Kiot Nguyễn Huệ', 'Thích Gà Express', 1, '0909888999', 'express@thichgapos.vn', '88 Phố Đi Bộ Nguyễn Huệ, Bến Nghé', 'Hồ Chí Minh', 'Quận 1', '0312345678-001', '🍗', '09:00', '23:00', 'VND', 'ACTIVE');

INSERT INTO store_settings (store_id, allow_negative_stock, allow_discount, allow_custom_price, allow_cancel_item, allow_cancel_order, allow_refund, payment_cash, payment_transfer, payment_qr, payment_card, receipt_header, receipt_footer, receipt_paper_size, bank_name, bank_account_number, bank_account_holder, kds_enabled, kds_completion_message, workflow_definition) VALUES
(1, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 'HỆ THỐNG GÀ RÁN & TRÀ SỮA THÍCH GÀ', 'Cảm ơn Quý khách & Hẹn gặp lại!', '80mm', 'MB Bank', '090123456789', 'THICH GA POS CN1', TRUE, 'Món ăn {mon}, bàn {ban} đã xong', '{"name":"Thu ngân - Bếp - Thanh toán","steps":[{"id":"create","name":"Thu ngân tạo đơn","type":"CREATE","roles":["CASHIER"]},{"id":"kitchen","name":"Bếp chế biến","type":"KITCHEN","roles":["KITCHEN"]},{"id":"payment","name":"Thu ngân thanh toán","type":"PAYMENT","roles":["CASHIER"]}]}'),
(2, FALSE, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 'THÍCH GÀ EXPRESS - MANG ĐI SIÊU TỐC', 'Chúc Quý khách ngon miệng!', '58mm', 'MB Bank', '090988899999', 'THICH GA EXPRESS', TRUE, 'Món ăn {mon}, bàn {ban} đã xong', '{"name":"Thu ngân - Bếp - Thanh toán","steps":[{"id":"create","name":"Thu ngân tạo đơn","type":"CREATE","roles":["CASHIER"]},{"id":"kitchen","name":"Bếp chế biến","type":"KITCHEN","roles":["KITCHEN"]},{"id":"payment","name":"Thu ngân thanh toán","type":"PAYMENT","roles":["CASHIER"]}]}');

INSERT INTO users (id, username, email, password_hash, full_name, phone, role, status) VALUES
(1, 'admin', 'admin@thichgapos.com', '$2a$10$yDKokN0lYAcpyQIGv0szqeXEmrW3z2XjqjMvm6DqNnDjJiH.lcWG6', 'Quản trị viên Hệ Thống', '0900000001', 'SUPER_ADMIN', 'ACTIVE'),
(2, 'manager', 'manager@thichgapos.com', '$2a$10$yDKokN0lYAcpyQIGv0szqeXEmrW3z2XjqjMvm6DqNnDjJiH.lcWG6', 'Nguyễn Quản Lý', '0900000002', 'STORE_MANAGER', 'ACTIVE'),
(3, 'cashier', 'cashier@thichgapos.com', '$2a$10$yDKokN0lYAcpyQIGv0szqeXEmrW3z2XjqjMvm6DqNnDjJiH.lcWG6', 'Trần Thu Ngân', '0900000003', 'CASHIER', 'ACTIVE'),
(4, 'kitchen', 'kitchen@thichgapos.com', '$2a$10$yDKokN0lYAcpyQIGv0szqeXEmrW3z2XjqjMvm6DqNnDjJiH.lcWG6', 'Lê Đầu Bếp', '0900000004', 'KITCHEN', 'ACTIVE'),
(5, 'order', 'order@thichgapos.com', '$2a$10$yDKokN0lYAcpyQIGv0szqeXEmrW3z2XjqjMvm6DqNnDjJiH.lcWG6', 'Phạm Nhân Viên Order', '0900000005', 'ORDER_STAFF', 'ACTIVE');

INSERT INTO user_stores (user_id, store_id, is_default) VALUES
(1, 1, TRUE),
(1, 2, FALSE),
(2, 1, TRUE),
(3, 1, TRUE),
(4, 1, TRUE),
(5, 1, TRUE);

INSERT INTO role_features (role, feature_code, enabled) VALUES
('ADMIN', 'POS', TRUE), ('ADMIN', 'TABLES', TRUE), ('ADMIN', 'KDS', TRUE), ('ADMIN', 'ORDERS', TRUE), ('ADMIN', 'HISTORY', TRUE), ('ADMIN', 'ADMIN', TRUE), ('ADMIN', 'SHIFT', TRUE), ('ADMIN', 'DISCOUNT', TRUE), ('ADMIN', 'COMPLETED_ITEMS', TRUE),
('STORE_MANAGER', 'POS', TRUE), ('STORE_MANAGER', 'TABLES', TRUE), ('STORE_MANAGER', 'KDS', TRUE), ('STORE_MANAGER', 'ORDERS', TRUE), ('STORE_MANAGER', 'HISTORY', TRUE), ('STORE_MANAGER', 'ADMIN', TRUE), ('STORE_MANAGER', 'SHIFT', TRUE), ('STORE_MANAGER', 'DISCOUNT', TRUE), ('STORE_MANAGER', 'COMPLETED_ITEMS', TRUE),
('ORDER_STAFF', 'POS', TRUE), ('ORDER_STAFF', 'TABLES', TRUE), ('ORDER_STAFF', 'KDS', FALSE), ('ORDER_STAFF', 'ORDERS', TRUE), ('ORDER_STAFF', 'HISTORY', TRUE), ('ORDER_STAFF', 'PAYMENT', FALSE), ('ORDER_STAFF', 'ADMIN', FALSE), ('ORDER_STAFF', 'SHIFT', FALSE), ('ORDER_STAFF', 'DISCOUNT', FALSE), ('ORDER_STAFF', 'COMPLETED_ITEMS', TRUE),
('ADMIN', 'PAYMENT', TRUE), ('STORE_MANAGER', 'PAYMENT', TRUE),
('CASHIER', 'POS', TRUE), ('CASHIER', 'TABLES', TRUE), ('CASHIER', 'KDS', FALSE), ('CASHIER', 'ORDERS', TRUE), ('CASHIER', 'HISTORY', TRUE), ('CASHIER', 'ADMIN', FALSE), ('CASHIER', 'SHIFT', TRUE), ('CASHIER', 'DISCOUNT', TRUE), ('CASHIER', 'COMPLETED_ITEMS', TRUE),
('CASHIER', 'PAYMENT', TRUE),
('KITCHEN', 'POS', FALSE), ('KITCHEN', 'TABLES', FALSE), ('KITCHEN', 'KDS', TRUE), ('KITCHEN', 'ORDERS', FALSE), ('KITCHEN', 'HISTORY', TRUE), ('KITCHEN', 'ADMIN', FALSE), ('KITCHEN', 'SHIFT', FALSE), ('KITCHEN', 'DISCOUNT', FALSE), ('KITCHEN', 'COMPLETED_ITEMS', FALSE),
('KITCHEN', 'PAYMENT', FALSE);

INSERT INTO categories (id, store_id, code, name, description, sort_order) VALUES
(1, 1, 'GA', 'Gà Rán & Cơm Gà', 'Các món gà rán thơm giòn vàng rụm', 1),
(2, 1, 'NUOC', 'Trà Sữa & Đồ Uống', 'Trà sữa đậm vị, cà phê và nước ép tươi', 2),
(3, 1, 'ANVAT', 'Món Ăn Kèm', 'Khoai tây, xúc xích và món vặt', 3),
(4, 2, 'GA_EXP', 'Gà Rán Mang Đi', 'Gà rán phục vụ nhanh mang đi', 1),
(5, 2, 'NUOC_EXP', 'Trà & Nước Uống Mang Đi', 'Đồ uống ly nắp cầu tiện lợi', 2);

INSERT INTO products (id, store_id, category_id, code, name, description, price, cost_price, unit, image_url, kitchen_type, is_active) VALUES
(1, 1, 1, 'GA01', 'Gà Rán Giòn Cay', 'Miếng gà rán tẩm bột giòn tan, vị cay vừa miệng', 35000, 18000, 'Miếng', '🍗', 'KITCHEN', TRUE),
(2, 1, 1, 'GA02', 'Cơm Gà Xối Mỡ Mắm Tỏi', 'Cơm vàng dẻo ăn kèm đùi gà góc tư sốt nước mắm tỏi ớt', 45000, 22000, 'Dĩa', '🍚', 'KITCHEN', TRUE),
(3, 1, 1, 'GA03', 'Đùi Gà Sốt Cay Hàn Quốc', 'Đùi gà giòn quyện sốt cay ngọt kiểu Hàn chuẩn vị', 40000, 20000, 'Cái', '🍗', 'KITCHEN', TRUE),
(4, 1, 2, 'TS01', 'Trà Sữa Trân Châu Đường Đen', 'Trà sữa Đài Loan thơm béo kèm trân châu nấu đường đen', 30000, 10000, 'Ly', '🧋', 'BAR', TRUE),
(5, 1, 2, 'TS02', 'Trà Đào Cam Sả', 'Trà thảo mộc thanh mát với đào miếng giòn ngọt', 28000, 9000, 'Ly', '🍹', 'BAR', TRUE),
(6, 1, 2, 'CF01', 'Cà Phê Sữa Đá Sài Gòn', 'Cà phê Robusta pha phin đậm đà thơm ngậy sữa đặc', 22000, 7000, 'Ly', '☕', 'BAR', TRUE),
(7, 1, 3, 'AV01', 'Khoai Tây Chiên Lắc Phô Mai', 'Khoai tây cọng giòn rụm phủ lớp bột phô mai béo thơm', 25000, 11000, 'Phần', '🍟', 'KITCHEN', TRUE),
(8, 2, 4, 'EXP01', 'Combo Gà Rán + Pepsi Mang Đi', '1 miếng gà rán giòn cay + 1 lon Pepsi mát lạnh', 45000, 22000, 'Combo', '🍗', 'KITCHEN', TRUE),
(9, 2, 5, 'EXP02', 'Trà Sữa Trân Châu Mang Đi', 'Trà sữa ly lớn 700ml trân châu sẵn sàng mang đi', 32000, 11000, 'Ly', '🧋', 'BAR', TRUE);

INSERT INTO product_variants (product_id, size_name, price_adjustment, is_default) VALUES
(4, 'Size M', 0, TRUE),
(4, 'Size L (+6k)', 6000, FALSE),
(5, 'Size M', 0, TRUE),
(5, 'Size L (+5k)', 5000, FALSE),
(6, 'Ly Tiêu Chuẩn', 0, TRUE);

INSERT INTO topping_groups (store_id, name, description, sort_order, is_active) VALUES
(1, 'Topping đồ uống', 'Topping dùng cho trà sữa và đồ uống', 1, TRUE),
(1, 'Món thêm', 'Món ăn thêm cho cơm và đồ ăn', 2, TRUE),
(2, 'Topping đồ uống', 'Topping cho đồ uống mang đi', 1, TRUE);

INSERT INTO product_options (store_id, group_id, name, price, is_active) VALUES
(1, (SELECT id FROM topping_groups WHERE store_id=1 AND name='Topping đồ uống'), 'Trân châu đen', 5000, TRUE),
(1, (SELECT id FROM topping_groups WHERE store_id=1 AND name='Topping đồ uống'), 'Kem Cheese Macchiato', 10000, TRUE),
(1, (SELECT id FROM topping_groups WHERE store_id=1 AND name='Topping đồ uống'), 'Thạch dừa non', 5000, TRUE),
(1, (SELECT id FROM topping_groups WHERE store_id=1 AND name='Món thêm'), 'Thêm 1 Trứng ốp la', 7000, TRUE),
(1, (SELECT id FROM topping_groups WHERE store_id=1 AND name='Món thêm'), 'Thêm Cơm trắng xối mỡ', 5000, TRUE),
(2, (SELECT id FROM topping_groups WHERE store_id=2 AND name='Topping đồ uống'), 'Thêm Trân châu', 5000, TRUE);

INSERT INTO product_option_products (option_id, product_id)
SELECT po.id, p.id
FROM product_options po
JOIN products p ON p.store_id = po.store_id
WHERE (po.store_id = 1 AND po.name IN ('Trân châu đen', 'Kem Cheese Macchiato', 'Thạch dừa non') AND p.id IN (4, 5, 6))
   OR (po.store_id = 1 AND po.name IN ('Thêm 1 Trứng ốp la', 'Thêm Cơm trắng xối mỡ') AND p.id = 2)
   OR (po.store_id = 2 AND po.name = 'Thêm Trân châu' AND p.id = 9);

INSERT INTO areas (id, store_id, name, sort_order, is_active) VALUES
(1, 1, 'Tầng 1 - Phòng Máy Lạnh', 1, TRUE),
(2, 1, 'Tầng 2 - View Sân Vườn', 2, TRUE);

INSERT INTO tables (id, store_id, area_id, code, name, seats, status, sort_order) VALUES
(1, 1, 1, 'B01', 'Bàn 01', 4, 'EMPTY', 1),
(2, 1, 1, 'B02', 'Bàn 02', 4, 'EMPTY', 2),
(3, 1, 1, 'B03', 'Bàn 03', 2, 'EMPTY', 3),
(4, 1, 1, 'B04', 'Bàn 04', 6, 'EMPTY', 4),
(5, 1, 2, 'B05', 'Bàn 05 (VIP)', 8, 'EMPTY', 5),
(6, 1, 2, 'B06', 'Bàn 06', 4, 'EMPTY', 6),
(7, 1, 2, 'B07', 'Bàn 07', 4, 'EMPTY', 7);
