-- ThichGaPOS v1.0 - Database Schema (PostgreSQL)
-- Multi-Store Architecture for Food & Beverage POS

-- 1. STORE TYPES & FEATURES
CREATE TABLE IF NOT EXISTS store_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_type_features (
    id SERIAL PRIMARY KEY,
    store_type_id INT REFERENCES store_types(id) ON DELETE CASCADE,
    feature_code VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_type_id, feature_code)
);

-- 2. STORES & STORE SETTINGS
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    display_name VARCHAR(150),
    store_type_id INT REFERENCES store_types(id),
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
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SUSPENDED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_settings (
    id SERIAL PRIMARY KEY,
    store_id INT UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    allow_negative_stock BOOLEAN DEFAULT FALSE,
    allow_discount BOOLEAN DEFAULT TRUE,
    allow_custom_price BOOLEAN DEFAULT FALSE,
    allow_cancel_item BOOLEAN DEFAULT TRUE,
    allow_cancel_order BOOLEAN DEFAULT TRUE,
    allow_refund BOOLEAN DEFAULT TRUE,
    payment_cash BOOLEAN DEFAULT TRUE,
    payment_transfer BOOLEAN DEFAULT TRUE,
    payment_qr BOOLEAN DEFAULT TRUE,
    payment_card BOOLEAN DEFAULT TRUE,
    receipt_header TEXT,
    receipt_footer TEXT,
    receipt_paper_size VARCHAR(10) DEFAULT '80mm', -- 58mm, 80mm
    bank_name VARCHAR(100) DEFAULT 'MB Bank',
    bank_account_number VARCHAR(50) DEFAULT '9999988888',
    bank_account_holder VARCHAR(100) DEFAULT 'THICHGAPOS STORE',
    kds_enabled BOOLEAN DEFAULT TRUE,
    kds_auto_print BOOLEAN DEFAULT FALSE,
    kds_completion_message TEXT DEFAULT 'Món ăn {mon}, bàn {ban} đã xong',
    takeaway_workspace_enabled BOOLEAN DEFAULT NULL,
    workflow_definition JSONB DEFAULT '{"name":"Thu ngân - Bếp - Thanh toán","steps":[{"id":"create","name":"Thu ngân tạo đơn","type":"CREATE","roles":["CASHIER"]},{"id":"kitchen","name":"Bếp chế biến","type":"KITCHEN","roles":["KITCHEN"]},{"id":"payment","name":"Thu ngân thanh toán","type":"PAYMENT","roles":["CASHIER"]}]}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. USERS, ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(30) NOT NULL DEFAULT 'CASHIER', -- SUPER_ADMIN, ADMIN, STORE_MANAGER, CASHIER, KITCHEN, STAFF
    status VARCHAR(20) DEFAULT 'ACTIVE',
    completed_items_enabled BOOLEAN DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_stores (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, store_id)
);

-- A STORE_MANAGER owns exactly one store. Deferred constraint triggers allow an
-- assignment to be replaced inside one transaction while validating the final state.
CREATE OR REPLACE FUNCTION enforce_store_manager_single_store()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id INT;
    target_role VARCHAR(30);
    assigned_store_count INT;
BEGIN
    IF TG_TABLE_NAME = 'users' THEN
        target_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
    ELSE
        target_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
    END IF;

    SELECT role INTO target_role FROM users WHERE id = target_user_id;
    IF target_role = 'STORE_MANAGER' THEN
        SELECT COUNT(*) INTO assigned_store_count FROM user_stores WHERE user_id = target_user_id;
        IF assigned_store_count <> 1 THEN
            RAISE EXCEPTION 'STORE_MANAGER % must be assigned to exactly one store', target_user_id
                USING ERRCODE = '23514';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_store_manager_user_assignment ON users;
CREATE CONSTRAINT TRIGGER trg_store_manager_user_assignment
AFTER INSERT OR UPDATE OF role ON users
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_store_manager_single_store();

DROP TRIGGER IF EXISTS trg_store_manager_store_assignment ON user_stores;
CREATE CONSTRAINT TRIGGER trg_store_manager_store_assignment
AFTER INSERT OR UPDATE OR DELETE ON user_stores
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_store_manager_single_store();

-- Feature visibility by role. Store type features and role features are evaluated together.
CREATE TABLE IF NOT EXISTS role_features (
    role VARCHAR(30) NOT NULL,
    feature_code VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role, feature_code)
);

-- Per-store overrides configured by that store's manager.
CREATE TABLE IF NOT EXISTS store_role_features (
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL,
    feature_code VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (store_id, role, feature_code)
);

-- 4. CATEGORIES & PRODUCTS
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    code VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cost_price NUMERIC(15, 2) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'Phần',
    image_url TEXT,
    kitchen_type VARCHAR(20) DEFAULT 'KITCHEN', -- KITCHEN (bếp đồ ăn), BAR (pha chế đồ uống)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, code)
);

CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    size_name VARCHAR(50) NOT NULL, -- S, M, L, Tiêu chuẩn
    price_adjustment NUMERIC(15, 2) DEFAULT 0, -- Chênh lệch so với giá gốc
    is_default BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS topping_groups (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(store_id, name)
);

CREATE TABLE IF NOT EXISTS product_options (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    group_id INT REFERENCES topping_groups(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL, -- Trân châu, Phô mai, Trứng ốp la
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

ALTER TABLE product_options
    ADD COLUMN IF NOT EXISTS group_id INT REFERENCES topping_groups(id) ON DELETE SET NULL;

-- A topping is only offered for products explicitly linked here.
CREATE TABLE IF NOT EXISTS product_option_products (
    option_id INT REFERENCES product_options(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (option_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_option_products_product
    ON product_option_products(product_id);

-- 5. AREAS & TABLES (FOR DINE-IN STORES)
CREATE TABLE IF NOT EXISTS areas (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tables (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    area_id INT REFERENCES areas(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    seats INT DEFAULT 4,
    status VARCHAR(20) DEFAULT 'EMPTY', -- EMPTY, OCCUPIED, RESERVED
    current_order_id INT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, code)
);

-- 6. SHIFTS (CA LÀM VIỆC)
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id),
    opening_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closing_time TIMESTAMP WITH TIME ZONE,
    opening_cash NUMERIC(15, 2) DEFAULT 0,
    closing_cash NUMERIC(15, 2) DEFAULT 0,
    expected_cash NUMERIC(15, 2) DEFAULT 0,
    difference NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, CLOSED
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. ORDERS & ORDER ITEMS
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_code VARCHAR(50) UNIQUE NOT NULL,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    shift_id INT REFERENCES shifts(id) ON DELETE SET NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'TAKEAWAY', -- DINE_IN, TAKEAWAY, DELIVERY
    order_source VARCHAR(20) DEFAULT 'POS', -- POS, QR_TABLE, WEB
    fulfillment_type VARCHAR(30), -- SHIP_DELIVERY, CUSTOMER_PICKUP, APP_DELIVERY
    table_id INT REFERENCES tables(id) ON DELETE SET NULL,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    delivery_address TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    cashier_id INT REFERENCES users(id),
    confirmed_by INT REFERENCES users(id),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15, 2) DEFAULT 0,
    tax_amount NUMERIC(15, 2) DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'UNPAID', -- UNPAID, PARTIALLY_PAID, PAID, REFUNDED
    order_status VARCHAR(20) DEFAULT 'CONFIRMED', -- PENDING_CONFIRMATION, CONFIRMED, PREPARING, READY, COMPLETED, CANCELLED
    workflow_stage_index INT DEFAULT 0,
    workflow_snapshot JSONB,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_by INT REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE SET NULL,
    variant_id INT REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name VARCHAR(150) NOT NULL,
    variant_name VARCHAR(50),
    unit_price NUMERIC(15, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal NUMERIC(15, 2) NOT NULL,
    note TEXT,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, PREPARING, READY, SERVED, CANCELLED
    kitchen_type VARCHAR(20) DEFAULT 'KITCHEN',
    prepared_by INT REFERENCES users(id) ON DELETE SET NULL,
    prepared_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_item_options (
    id SERIAL PRIMARY KEY,
    order_item_id INT REFERENCES order_items(id) ON DELETE CASCADE,
    option_id INT REFERENCES product_options(id) ON DELETE SET NULL,
    option_name VARCHAR(100) NOT NULL,
    price NUMERIC(15, 2) NOT NULL DEFAULT 0
);

-- 8. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id) ON DELETE CASCADE,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    payment_method VARCHAR(30) NOT NULL, -- CASH, BANK_TRANSFER, QR, CARD
    amount NUMERIC(15, 2) NOT NULL,
    cash_received NUMERIC(15, 2) DEFAULT 0,
    cash_return NUMERIC(15, 2) DEFAULT 0,
    transaction_code VARCHAR(100),
    status VARCHAR(20) DEFAULT 'SUCCESS', -- SUCCESS, FAILED, CANCELLED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE SET NULL,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    old_value JSONB,
    new_value JSONB,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES for Multi-Store fast querying
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_store ON categories(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tables_store ON tables(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id, order_status, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_prepared_by ON order_items(prepared_by, prepared_at DESC);
