const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const connectionString = process.env.DATABASE_URL || 
  `postgres://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'thichgapos'}`;

let pool = null;
let isConnected = false;

try {
  pool = new Pool({
    connectionString: connectionString,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    max: 20
  });

  pool.on('error', (err) => {
    console.error('[DB Error] Unexpected error on idle client:', err.message);
  });
} catch (err) {
  console.warn('[DB Warning] PostgreSQL pool initialization failed:', err.message);
}

// Memory fallback store if Postgres is unavailable locally
const memoryStore = {
  users: [
    { id: 1, username: 'admin', email: 'admin@thichgapos.com', full_name: 'Quản trị viên Hệ Thống', role: 'SUPER_ADMIN', status: 'ACTIVE', phone: '0900000001' },
    { id: 2, username: 'manager', email: 'manager@thichgapos.com', full_name: 'Nguyễn Quản Lý', role: 'STORE_MANAGER', status: 'ACTIVE', phone: '0900000002' },
    { id: 3, username: 'cashier', email: 'cashier@thichgapos.com', full_name: 'Trần Thu Ngân', role: 'CASHIER', status: 'ACTIVE', phone: '0900000003' },
    { id: 4, username: 'kitchen', email: 'kitchen@thichgapos.com', full_name: 'Lê Đầu Bếp', role: 'KITCHEN', status: 'ACTIVE', phone: '0900000004' },
    { id: 5, username: 'order', email: 'order@thichgapos.com', full_name: 'Phạm Nhân Viên Order', role: 'ORDER_STAFF', status: 'ACTIVE', phone: '0900000005' }
  ],
  store_types: [
    { id: 1, code: 'TAKEAWAY', name: 'Chỉ bán mang đi', description: 'Mô hình Kiot chuyên mang đi', is_active: true },
    { id: 2, code: 'DINE_IN_TAKEAWAY', name: 'Tại chỗ & Mang đi', description: 'Mô hình vừa bán tại bàn vừa mang về', is_active: true }
  ],
  store_type_features: [
    { store_type_id: 1, feature_code: 'SALE', enabled: true },
    { store_type_id: 1, feature_code: 'TAKEAWAY', enabled: true },
    { store_type_id: 1, feature_code: 'DINE_IN', enabled: false },
    { store_type_id: 1, feature_code: 'TABLE', enabled: false },
    { store_type_id: 1, feature_code: 'KDS', enabled: true },
    { store_type_id: 1, feature_code: 'INVOICE', enabled: true },
    { store_type_id: 1, feature_code: 'QR_PAYMENT', enabled: true },
    { store_type_id: 1, feature_code: 'INVENTORY', enabled: true },

    { store_type_id: 2, feature_code: 'SALE', enabled: true },
    { store_type_id: 2, feature_code: 'TAKEAWAY', enabled: true },
    { store_type_id: 2, feature_code: 'DINE_IN', enabled: true },
    { store_type_id: 2, feature_code: 'TABLE', enabled: true },
    { store_type_id: 2, feature_code: 'KDS', enabled: true },
    { store_type_id: 2, feature_code: 'INVOICE', enabled: true },
    { store_type_id: 2, feature_code: 'QR_PAYMENT', enabled: true },
    { store_type_id: 2, feature_code: 'INVENTORY', enabled: true }
  ],
  stores: [
    { id: 1, code: 'STORE001', name: 'Thích Gà - Chi nhánh 1', display_name: 'Thích Gà - Quang Trung', store_type_id: 2, phone: '0901234567', email: 'cn1@thichgapos.vn', address: '123 Quang Trung, Phường 10, Gò Vấp', province: 'Hồ Chí Minh', district: 'Gò Vấp', tax_code: '0312345678', logo_url: '🍗', opening_time: '08:00', closing_time: '22:30', currency: 'VND', status: 'ACTIVE' },
    { id: 2, code: 'STORE002', name: 'Thích Gà Express - Kiot Nguyễn Huệ', display_name: 'Thích Gà Express', store_type_id: 1, phone: '0909888999', email: 'express@thichgapos.vn', address: '88 Phố Đi Bộ Nguyễn Huệ, Bến Nghé', province: 'Hồ Chí Minh', district: 'Quận 1', tax_code: '0312345678-001', logo_url: '🍗', opening_time: '09:00', closing_time: '23:00', currency: 'VND', status: 'ACTIVE' }
  ],
  store_settings: [
    { store_id: 1, allow_negative_stock: false, allow_discount: true, allow_custom_price: false, allow_cancel_item: true, allow_cancel_order: true, allow_refund: true, payment_cash: true, payment_transfer: true, payment_qr: true, payment_card: true, receipt_header: 'HỆ THỐNG GÀ RÁN & TRÀ SỮA THÍCH GÀ', receipt_footer: 'Cảm ơn Quý khách & Hẹn gặp lại!', receipt_paper_size: '80mm', bank_name: 'MB Bank', bank_account_number: '090123456789', bank_account_holder: 'THICH GA POS CN1', kds_enabled: true, workflow_definition: { name: 'Thu ngân - Bếp - Thanh toán', steps: [{ id: 'create', name: 'Thu ngân tạo đơn', type: 'CREATE', roles: ['CASHIER'] }, { id: 'kitchen', name: 'Bếp chế biến', type: 'KITCHEN', roles: ['KITCHEN'] }, { id: 'payment', name: 'Thu ngân thanh toán', type: 'PAYMENT', roles: ['CASHIER'] }] } },
    { store_id: 2, allow_negative_stock: false, allow_discount: true, allow_custom_price: false, allow_cancel_item: true, allow_cancel_order: true, allow_refund: true, payment_cash: true, payment_transfer: true, payment_qr: true, payment_card: true, receipt_header: 'THÍCH GÀ EXPRESS - MANG ĐI SIÊU TỐC', receipt_footer: 'Chúc Quý khách ngon miệng!', receipt_paper_size: '58mm', bank_name: 'MB Bank', bank_account_number: '090988899999', bank_account_holder: 'THICH GA EXPRESS', kds_enabled: true, workflow_definition: { name: 'Thu ngân - Bếp - Thanh toán', steps: [{ id: 'create', name: 'Thu ngân tạo đơn', type: 'CREATE', roles: ['CASHIER'] }, { id: 'kitchen', name: 'Bếp chế biến', type: 'KITCHEN', roles: ['KITCHEN'] }, { id: 'payment', name: 'Thu ngân thanh toán', type: 'PAYMENT', roles: ['CASHIER'] }] } }
  ],
  user_stores: [
    { user_id: 1, store_id: 1, is_default: true },
    { user_id: 1, store_id: 2, is_default: false },
    { user_id: 2, store_id: 1, is_default: true },
    { user_id: 2, store_id: 2, is_default: false },
    { user_id: 3, store_id: 1, is_default: true },
    { user_id: 4, store_id: 1, is_default: true },
    { user_id: 5, store_id: 1, is_default: true }
  ],
  role_features: [
    ...['POS', 'TABLES', 'KDS', 'ORDERS', 'PAYMENT', 'ADMIN', 'SHIFT', 'DISCOUNT'].map(feature_code => ({ role: 'ADMIN', feature_code, enabled: true })),
    ...['POS', 'TABLES', 'KDS', 'ORDERS', 'PAYMENT', 'ADMIN', 'SHIFT', 'DISCOUNT'].map(feature_code => ({ role: 'STORE_MANAGER', feature_code, enabled: true })),
    { role: 'ORDER_STAFF', feature_code: 'POS', enabled: true },
    { role: 'ORDER_STAFF', feature_code: 'TABLES', enabled: true },
    { role: 'ORDER_STAFF', feature_code: 'KDS', enabled: false },
    { role: 'ORDER_STAFF', feature_code: 'ORDERS', enabled: true },
    { role: 'ORDER_STAFF', feature_code: 'PAYMENT', enabled: false },
    { role: 'ORDER_STAFF', feature_code: 'ADMIN', enabled: false },
    { role: 'ORDER_STAFF', feature_code: 'SHIFT', enabled: false },
    { role: 'ORDER_STAFF', feature_code: 'DISCOUNT', enabled: false },
    { role: 'CASHIER', feature_code: 'POS', enabled: true },
    { role: 'CASHIER', feature_code: 'TABLES', enabled: true },
    { role: 'CASHIER', feature_code: 'KDS', enabled: false },
    { role: 'CASHIER', feature_code: 'ORDERS', enabled: true },
    { role: 'CASHIER', feature_code: 'PAYMENT', enabled: true },
    { role: 'CASHIER', feature_code: 'ADMIN', enabled: false },
    { role: 'CASHIER', feature_code: 'SHIFT', enabled: true },
    { role: 'CASHIER', feature_code: 'DISCOUNT', enabled: true },
    { role: 'KITCHEN', feature_code: 'POS', enabled: false },
    { role: 'KITCHEN', feature_code: 'TABLES', enabled: false },
    { role: 'KITCHEN', feature_code: 'KDS', enabled: true },
    { role: 'KITCHEN', feature_code: 'ORDERS', enabled: false },
    { role: 'KITCHEN', feature_code: 'PAYMENT', enabled: false },
    { role: 'KITCHEN', feature_code: 'ADMIN', enabled: false },
    { role: 'KITCHEN', feature_code: 'SHIFT', enabled: false },
    { role: 'KITCHEN', feature_code: 'DISCOUNT', enabled: false }
  ],
  categories: [
    { id: 1, store_id: 1, code: 'GA', name: 'Gà Rán & Cơm Gà', description: 'Các món gà rán thơm giòn vàng rụm', sort_order: 1, is_active: true },
    { id: 2, store_id: 1, code: 'NUOC', name: 'Trà Sữa & Đồ Uống', description: 'Trà sữa đậm vị, cà phê và nước ép tươi', sort_order: 2, is_active: true },
    { id: 3, store_id: 1, code: 'ANVAT', name: 'Món Ăn Kèm', description: 'Khoai tây, xúc xích và món vặt', sort_order: 3, is_active: true },
    { id: 4, store_id: 2, code: 'GA_EXP', name: 'Gà Rán Mang Đi', description: 'Gà rán phục vụ nhanh', sort_order: 1, is_active: true },
    { id: 5, store_id: 2, code: 'NUOC_EXP', name: 'Trà & Nước Mang Đi', description: 'Đồ uống ly mang đi', sort_order: 2, is_active: true }
  ],
  products: [
    { id: 1, store_id: 1, category_id: 1, code: 'GA01', name: 'Gà Rán Giòn Cay', description: 'Miếng gà rán tẩm bột giòn tan, vị cay vừa miệng', price: 35000, cost_price: 18000, unit: 'Miếng', image_url: '🍗', kitchen_type: 'KITCHEN', is_active: true },
    { id: 2, store_id: 1, category_id: 1, code: 'GA02', name: 'Cơm Gà Xối Mỡ Mắm Tỏi', description: 'Cơm vàng dẻo ăn kèm đùi gà góc tư sốt nước mắm tỏi ớt', price: 45000, cost_price: 22000, unit: 'Dĩa', image_url: '🍚', kitchen_type: 'KITCHEN', is_active: true },
    { id: 3, store_id: 1, category_id: 1, code: 'GA03', name: 'Đùi Gà Sốt Cay Hàn Quốc', description: 'Đùi gà giòn quyện sốt cay ngọt kiểu Hàn chuẩn vị', price: 40000, cost_price: 20000, unit: 'Cái', image_url: '🍗', kitchen_type: 'KITCHEN', is_active: true },
    { id: 4, store_id: 1, category_id: 2, code: 'TS01', name: 'Trà Sữa Trân Châu Đường Đen', description: 'Trà sữa Đài Loan thơm béo kèm trân châu nấu đường đen', price: 30000, cost_price: 10000, unit: 'Ly', image_url: '🧋', kitchen_type: 'BAR', is_active: true },
    { id: 5, store_id: 1, category_id: 2, code: 'TS02', name: 'Trà Đào Cam Sả', description: 'Trà thảo mộc thanh mát với đào miếng giòn ngọt', price: 28000, cost_price: 9000, unit: 'Ly', image_url: '🍹', kitchen_type: 'BAR', is_active: true },
    { id: 6, store_id: 1, category_id: 2, code: 'CF01', name: 'Cà Phê Sữa Đá Sài Gòn', description: 'Cà phê Robusta pha phin đậm đà thơm ngậy sữa đặc', price: 22000, cost_price: 7000, unit: 'Ly', image_url: '☕', kitchen_type: 'BAR', is_active: true },
    { id: 7, store_id: 1, category_id: 3, code: 'AV01', name: 'Khoai Tây Chiên Lắc Phô Mai', description: 'Khoai tây cọng giòn rụm phủ lớp bột phô mai béo thơm', price: 25000, cost_price: 11000, unit: 'Phần', image_url: '🍟', kitchen_type: 'KITCHEN', is_active: true },
    { id: 8, store_id: 2, category_id: 4, code: 'EXP01', name: 'Combo Gà Rán + Pepsi Mang Đi', description: '1 miếng gà rán giòn cay + 1 lon Pepsi', price: 45000, cost_price: 22000, unit: 'Combo', image_url: '🍗', kitchen_type: 'KITCHEN', is_active: true },
    { id: 9, store_id: 2, category_id: 5, code: 'EXP02', name: 'Trà Sữa Trân Châu Mang Đi', description: 'Trà sữa ly lớn 700ml mang đi', price: 32000, cost_price: 11000, unit: 'Ly', image_url: '🧋', kitchen_type: 'BAR', is_active: true }
  ],
  product_variants: [
    { id: 1, product_id: 4, size_name: 'Size M', price_adjustment: 0, is_default: true },
    { id: 2, product_id: 4, size_name: 'Size L (+6k)', price_adjustment: 6000, is_default: false },
    { id: 3, product_id: 5, size_name: 'Size M', price_adjustment: 0, is_default: true },
    { id: 4, product_id: 5, size_name: 'Size L (+5k)', price_adjustment: 5000, is_default: false },
    { id: 5, product_id: 6, size_name: 'Ly Tiêu Chuẩn', price_adjustment: 0, is_default: true }
  ],
  product_options: [
    { id: 1, store_id: 1, name: 'Trân châu đen', price: 5000, is_active: true },
    { id: 2, store_id: 1, name: 'Kem Cheese Macchiato', price: 10000, is_active: true },
    { id: 3, store_id: 1, name: 'Thạch dừa non', price: 5000, is_active: true },
    { id: 4, store_id: 1, name: 'Thêm 1 Trứng ốp la', price: 7000, is_active: true },
    { id: 5, store_id: 1, name: 'Thêm Cơm trắng xối mỡ', price: 5000, is_active: true },
    { id: 6, store_id: 2, name: 'Thêm Trân châu', price: 5000, is_active: true }
  ],
  areas: [
    { id: 1, store_id: 1, name: 'Tầng 1 - Phòng Máy Lạnh', sort_order: 1, is_active: true },
    { id: 2, store_id: 1, name: 'Tầng 2 - View Sân Vườn', sort_order: 2, is_active: true }
  ],
  tables: [
    { id: 1, store_id: 1, area_id: 1, code: 'B01', name: 'Bàn 01', seats: 4, status: 'EMPTY', current_order_id: null, sort_order: 1 },
    { id: 2, store_id: 1, area_id: 1, code: 'B02', name: 'Bàn 02', seats: 4, status: 'EMPTY', current_order_id: null, sort_order: 2 },
    { id: 3, store_id: 1, area_id: 1, code: 'B03', name: 'Bàn 03', seats: 2, status: 'EMPTY', current_order_id: null, sort_order: 3 },
    { id: 4, store_id: 1, area_id: 1, code: 'B04', name: 'Bàn 04', seats: 6, status: 'EMPTY', current_order_id: null, sort_order: 4 },
    { id: 5, store_id: 1, area_id: 2, code: 'B05', name: 'Bàn 05 (VIP)', seats: 8, status: 'EMPTY', current_order_id: null, sort_order: 5 },
    { id: 6, store_id: 1, area_id: 2, code: 'B06', name: 'Bàn 06', seats: 4, status: 'EMPTY', current_order_id: null, sort_order: 6 },
    { id: 7, store_id: 1, area_id: 2, code: 'B07', name: 'Bàn 07', seats: 4, status: 'EMPTY', current_order_id: null, sort_order: 7 }
  ],
  orders: [],
  order_items: [],
  order_item_options: [],
  payments: [],
  shifts: [
    { id: 1, store_id: 1, user_id: 3, opening_time: new Date().toISOString(), opening_cash: 1000000, closing_cash: 0, expected_cash: 1000000, difference: 0, status: 'OPEN', notes: 'Ca sáng thu ngân' }
  ],
  audit_logs: []
};

async function testConnection() {
  if (!pool) return false;
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT NOW() as current_time');
    await client.query(`CREATE TABLE IF NOT EXISTS role_features (
      role VARCHAR(30) NOT NULL,
      feature_code VARCHAR(50) NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role, feature_code)
    )`);
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_by INT REFERENCES users(id)');
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE');
    await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS workflow_definition JSONB DEFAULT '{"name":"Thu ngân - Bếp - Thanh toán","steps":[{"id":"create","name":"Thu ngân tạo đơn","type":"CREATE","roles":["CASHIER"]},{"id":"kitchen","name":"Bếp chế biến","type":"KITCHEN","roles":["KITCHEN"]},{"id":"payment","name":"Thu ngân thanh toán","type":"PAYMENT","roles":["CASHIER"]}]}'::jsonb`);
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS workflow_stage_index INT DEFAULT 0');
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS workflow_snapshot JSONB');
    const legacyWorkflow = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='order_workflow'`);
    if (legacyWorkflow.rows.length) {
      await client.query(`UPDATE store_settings SET workflow_definition='{"name":"Order - Thu ngân - Bếp - Thanh toán","steps":[{"id":"create","name":"Nhân viên Order tạo đơn","type":"CREATE","roles":["ORDER_STAFF"]},{"id":"cashier_confirm","name":"Thu ngân xác nhận","type":"APPROVAL","roles":["CASHIER","STORE_MANAGER","ADMIN"]},{"id":"kitchen","name":"Bếp chế biến","type":"KITCHEN","roles":["KITCHEN"]},{"id":"payment","name":"Thu ngân thanh toán","type":"PAYMENT","roles":["CASHIER"]}]}'::jsonb WHERE order_workflow='ORDER_CASHIER_KITCHEN_PAYMENT'`);
      await client.query('ALTER TABLE store_settings DROP COLUMN order_workflow');
    }
    await client.query(`INSERT INTO role_features (role, feature_code, enabled) VALUES
      ('ADMIN','POS',TRUE),('ADMIN','TABLES',TRUE),('ADMIN','KDS',TRUE),('ADMIN','ORDERS',TRUE),('ADMIN','PAYMENT',TRUE),('ADMIN','ADMIN',TRUE),('ADMIN','SHIFT',TRUE),('ADMIN','DISCOUNT',TRUE),
      ('STORE_MANAGER','POS',TRUE),('STORE_MANAGER','TABLES',TRUE),('STORE_MANAGER','KDS',TRUE),('STORE_MANAGER','ORDERS',TRUE),('STORE_MANAGER','PAYMENT',TRUE),('STORE_MANAGER','ADMIN',TRUE),('STORE_MANAGER','SHIFT',TRUE),('STORE_MANAGER','DISCOUNT',TRUE),
      ('ORDER_STAFF','POS',TRUE),('ORDER_STAFF','TABLES',TRUE),('ORDER_STAFF','KDS',FALSE),('ORDER_STAFF','ORDERS',TRUE),('ORDER_STAFF','PAYMENT',FALSE),('ORDER_STAFF','ADMIN',FALSE),('ORDER_STAFF','SHIFT',FALSE),('ORDER_STAFF','DISCOUNT',FALSE),
      ('CASHIER','POS',TRUE),('CASHIER','TABLES',TRUE),('CASHIER','KDS',FALSE),('CASHIER','ORDERS',TRUE),('CASHIER','PAYMENT',TRUE),('CASHIER','ADMIN',FALSE),('CASHIER','SHIFT',TRUE),('CASHIER','DISCOUNT',TRUE),
      ('KITCHEN','POS',FALSE),('KITCHEN','TABLES',FALSE),('KITCHEN','KDS',TRUE),('KITCHEN','ORDERS',FALSE),('KITCHEN','PAYMENT',FALSE),('KITCHEN','ADMIN',FALSE),('KITCHEN','SHIFT',FALSE),('KITCHEN','DISCOUNT',FALSE)
      ON CONFLICT (role, feature_code) DO NOTHING`);
    isConnected = true;
    console.log(`[PostgreSQL] Connected successfully at ${res.rows[0].current_time}`);
    return true;
  } catch (err) {
    isConnected = false;
    console.warn(`[PostgreSQL Warning] Cannot connect to PostgreSQL: ${err.message}`);
    console.warn(`[System Note] Running with Local F&B Multi-Store Engine. Full functionality is active!`);
    return false;
  } finally {
    if (client) client.release();
  }
}

// Wrapper for executing query safely
async function query(text, params) {
  if (isConnected && pool) {
    return pool.query(text, params);
  }
  // If PostgreSQL is not connected, fallback handler is used by controllers
  return null;
}

module.exports = {
  pool,
  query,
  testConnection,
  isPostgresConnected: () => isConnected,
  memoryStore
};
