const { LEGACY_DATABASE_NAME } = require('./legacyBrand');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

if (process.env.DB_CLIENT === 'mysql') {
  module.exports = require('./mysqlDb');
} else {

// Correct bcrypt hash for the seeded demo password "123456". These legacy
// hashes were shipped in older seed files but do not validate that password.
const SEEDED_PASSWORD_HASH = '$2a$10$yDKokN0lYAcpyQIGv0szqeXEmrW3z2XjqjMvm6DqNnDjJiH.lcWG6';
const LEGACY_INVALID_PASSWORD_HASHES = [
  '$2a$10$wO0/s6vE2s.jI4dEfevNdu5lE8pG5eZ.pZ3X6r7F0K1x7aU8s02e.',
  '$2a$10$6l5B4rZf2hF27nffgRj27eX7E2bX8cMvO1o1bNfTskwWwNnNrmPae'
];

const connectionString = process.env.DATABASE_URL || 
  `postgres://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || LEGACY_DATABASE_NAME}`;

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
    { id: 1, username: 'admin', email: 'admin@onesoftpos.com', full_name: 'Quản trị viên Hệ Thống', role: 'SUPER_ADMIN', status: 'ACTIVE', phone: '0900000001' },
    { id: 2, username: 'manager', email: 'manager@onesoftpos.com', full_name: 'Nguyễn Quản Lý', role: 'STORE_MANAGER', status: 'ACTIVE', phone: '0900000002' },
    { id: 3, username: 'cashier', email: 'cashier@onesoftpos.com', full_name: 'Trần Thu Ngân', role: 'CASHIER', status: 'ACTIVE', phone: '0900000003' },
    { id: 4, username: 'kitchen', email: 'kitchen@onesoftpos.com', full_name: 'Lê Đầu Bếp', role: 'KITCHEN', status: 'ACTIVE', phone: '0900000004' },
    { id: 5, username: 'order', email: 'order@onesoftpos.com', full_name: 'Phạm Nhân Viên Order', role: 'ORDER_STAFF', status: 'ACTIVE', phone: '0900000005' }
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
    { id: 1, code: 'STORE001', name: 'OnesoftPOS - Chi nhánh 1', display_name: 'OnesoftPOS - Quang Trung', store_type_id: 2, phone: '0901234567', email: 'cn1@onesoftpos.vn', address: '123 Quang Trung, Phường 10, Gò Vấp', province: 'Hồ Chí Minh', district: 'Gò Vấp', tax_code: '0312345678', logo_url: '🍗', opening_time: '08:00', closing_time: '22:30', currency: 'VND', status: 'ACTIVE' },
    { id: 2, code: 'STORE002', name: 'OnesoftPOS Express - Kiot Nguyễn Huệ', display_name: 'OnesoftPOS Express', store_type_id: 1, phone: '0909888999', email: 'express@onesoftpos.vn', address: '88 Phố Đi Bộ Nguyễn Huệ, Bến Nghé', province: 'Hồ Chí Minh', district: 'Quận 1', tax_code: '0312345678-001', logo_url: '🍗', opening_time: '09:00', closing_time: '23:00', currency: 'VND', status: 'ACTIVE' }
  ],
  store_settings: [
    { store_id: 1, allow_negative_stock: false, allow_discount: true, allow_custom_price: false, allow_cancel_item: true, allow_cancel_order: true, allow_refund: true, payment_cash: true, payment_transfer: true, payment_qr: true, payment_card: true, receipt_header: 'HỆ THỐNG GÀ RÁN & TRÀ SỮA ONESOFTPOS', receipt_footer: 'Cảm ơn Quý khách & Hẹn gặp lại!', receipt_paper_size: '80mm', bank_name: 'MB Bank', bank_account_number: '090123456789', bank_account_holder: 'ONESOFTPOS CN1', kds_enabled: true, kds_completion_message: 'Món ăn {mon}, bàn {ban} đã xong', inventory_transactions_enabled: true, workflow_definition: { name: 'Thu ngân - Bếp - Thanh toán', steps: [{ id: 'create', name: 'Thu ngân tạo đơn', type: 'CREATE', roles: ['CASHIER'] }, { id: 'kitchen', name: 'Bếp chế biến', type: 'KITCHEN', roles: ['KITCHEN'] }, { id: 'payment', name: 'Thu ngân thanh toán', type: 'PAYMENT', roles: ['CASHIER'] }] } },
    { store_id: 2, allow_negative_stock: false, allow_discount: true, allow_custom_price: false, allow_cancel_item: true, allow_cancel_order: true, allow_refund: true, payment_cash: true, payment_transfer: true, payment_qr: true, payment_card: true, receipt_header: 'ONESOFTPOS EXPRESS - MANG ĐI SIÊU TỐC', receipt_footer: 'Chúc Quý khách ngon miệng!', receipt_paper_size: '58mm', bank_name: 'MB Bank', bank_account_number: '090988899999', bank_account_holder: 'ONESOFTPOS EXPRESS', kds_enabled: true, kds_completion_message: 'Món ăn {mon}, bàn {ban} đã xong', inventory_transactions_enabled: true, workflow_definition: { name: 'Thu ngân - Bếp - Thanh toán', steps: [{ id: 'create', name: 'Thu ngân tạo đơn', type: 'CREATE', roles: ['CASHIER'] }, { id: 'kitchen', name: 'Bếp chế biến', type: 'KITCHEN', roles: ['KITCHEN'] }, { id: 'payment', name: 'Thu ngân thanh toán', type: 'PAYMENT', roles: ['CASHIER'] }] } }
  ],
  user_stores: [
    { user_id: 1, store_id: 1, is_default: true },
    { user_id: 1, store_id: 2, is_default: false },
    { user_id: 2, store_id: 1, is_default: true },
    { user_id: 3, store_id: 1, is_default: true },
    { user_id: 4, store_id: 1, is_default: true },
    { user_id: 5, store_id: 1, is_default: true }
  ],
  role_features: [
    ...['POS', 'TABLES', 'KDS', 'ORDERS', 'HISTORY', 'PAYMENT', 'ADMIN', 'SHIFT', 'DISCOUNT', 'COMPLETED_ITEMS', 'INVENTORY'].map(feature_code => ({ role: 'ADMIN', feature_code, enabled: true })),
    ...['POS', 'TABLES', 'KDS', 'ORDERS', 'HISTORY', 'PAYMENT', 'ADMIN', 'SHIFT', 'DISCOUNT', 'COMPLETED_ITEMS', 'INVENTORY'].map(feature_code => ({ role: 'STORE_MANAGER', feature_code, enabled: true })),
    { role: 'ORDER_STAFF', feature_code: 'POS', enabled: true },
    { role: 'ORDER_STAFF', feature_code: 'TABLES', enabled: true },
    { role: 'ORDER_STAFF', feature_code: 'KDS', enabled: false },
    { role: 'ORDER_STAFF', feature_code: 'ORDERS', enabled: true },
    { role: 'ORDER_STAFF', feature_code: 'HISTORY', enabled: true },
    { role: 'ORDER_STAFF', feature_code: 'PAYMENT', enabled: false },
    { role: 'ORDER_STAFF', feature_code: 'ADMIN', enabled: false },
    { role: 'ORDER_STAFF', feature_code: 'SHIFT', enabled: false },
    { role: 'ORDER_STAFF', feature_code: 'DISCOUNT', enabled: false },
    { role: 'ORDER_STAFF', feature_code: 'COMPLETED_ITEMS', enabled: true },
    { role: 'CASHIER', feature_code: 'POS', enabled: true },
    { role: 'CASHIER', feature_code: 'TABLES', enabled: true },
    { role: 'CASHIER', feature_code: 'KDS', enabled: false },
    { role: 'CASHIER', feature_code: 'ORDERS', enabled: true },
    { role: 'CASHIER', feature_code: 'HISTORY', enabled: true },
    { role: 'CASHIER', feature_code: 'PAYMENT', enabled: true },
    { role: 'CASHIER', feature_code: 'ADMIN', enabled: false },
    { role: 'CASHIER', feature_code: 'SHIFT', enabled: true },
    { role: 'CASHIER', feature_code: 'DISCOUNT', enabled: true },
    { role: 'CASHIER', feature_code: 'COMPLETED_ITEMS', enabled: true },
    { role: 'KITCHEN', feature_code: 'POS', enabled: false },
    { role: 'KITCHEN', feature_code: 'TABLES', enabled: false },
    { role: 'KITCHEN', feature_code: 'KDS', enabled: true },
    { role: 'KITCHEN', feature_code: 'ORDERS', enabled: false },
    { role: 'KITCHEN', feature_code: 'HISTORY', enabled: true },
    { role: 'KITCHEN', feature_code: 'PAYMENT', enabled: false },
    { role: 'KITCHEN', feature_code: 'ADMIN', enabled: false },
    { role: 'KITCHEN', feature_code: 'SHIFT', enabled: false },
    { role: 'KITCHEN', feature_code: 'DISCOUNT', enabled: false },
    { role: 'KITCHEN', feature_code: 'COMPLETED_ITEMS', enabled: false }
  ],
  store_role_features: [],
  categories: [
    { id: 1, store_id: 1, code: 'GA', name: 'Gà Rán & Cơm Gà', description: 'Các món gà rán thơm giòn vàng rụm', sort_order: 1, is_active: true },
    { id: 2, store_id: 1, code: 'NUOC', name: 'Trà Sữa & Đồ Uống', description: 'Trà sữa đậm vị, cà phê và nước ép tươi', sort_order: 2, is_active: true },
    { id: 3, store_id: 1, code: 'ANVAT', name: 'Món Ăn Kèm', description: 'Khoai tây, xúc xích và món vặt', sort_order: 3, is_active: true },
    { id: 4, store_id: 2, code: 'GA_EXP', name: 'Gà Rán Mang Đi', description: 'Gà rán phục vụ nhanh', sort_order: 1, is_active: true },
    { id: 5, store_id: 2, code: 'NUOC_EXP', name: 'Trà & Nước Mang Đi', description: 'Đồ uống ly mang đi', sort_order: 2, is_active: true }
  ],
  sizes: [],
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
  topping_groups: [
    { id: 1, store_id: 1, name: 'Topping đồ uống', description: 'Topping dùng cho trà sữa và đồ uống', sort_order: 1, is_active: true },
    { id: 2, store_id: 1, name: 'Món thêm', description: 'Món ăn thêm cho cơm và đồ ăn', sort_order: 2, is_active: true },
    { id: 3, store_id: 2, name: 'Topping đồ uống', description: 'Topping cho đồ uống mang đi', sort_order: 1, is_active: true }
  ],
  product_options: [
    { id: 1, store_id: 1, group_id: 1, name: 'Trân châu đen', price: 5000, is_active: true },
    { id: 2, store_id: 1, group_id: 1, name: 'Kem Cheese Macchiato', price: 10000, is_active: true },
    { id: 3, store_id: 1, group_id: 1, name: 'Thạch dừa non', price: 5000, is_active: true },
    { id: 4, store_id: 1, group_id: 2, name: 'Thêm 1 Trứng ốp la', price: 7000, is_active: true },
    { id: 5, store_id: 1, group_id: 2, name: 'Thêm Cơm trắng xối mỡ', price: 5000, is_active: true },
    { id: 6, store_id: 2, group_id: 3, name: 'Thêm Trân châu', price: 5000, is_active: true }
  ],
  product_option_products: [
    ...[4, 5, 6].flatMap(product_id => [1, 2, 3].map(option_id => ({ option_id, product_id }))),
    { option_id: 4, product_id: 2 },
    { option_id: 5, product_id: 2 },
    { option_id: 6, product_id: 9 }
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
  audit_logs: [],
  inventory_items: [
    { id: 1, store_id: 1, code: 'NL01', name: 'Thịt gà góc tư tươi', category: 'Thịt & Hải sản', unit: 'kg', cost_price: 55000, current_stock: 45.5, min_stock: 15, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 2, store_id: 1, code: 'NL02', name: 'Đùi gà tỏi CP', category: 'Thịt & Hải sản', unit: 'kg', cost_price: 68000, current_stock: 32.0, min_stock: 10, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 3, store_id: 1, code: 'NL03', name: 'Bột chiên giòn cay cao cấp', category: 'Gia vị & Bột', unit: 'kg', cost_price: 35000, current_stock: 18.5, min_stock: 8, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 4, store_id: 1, code: 'NL04', name: 'Dầu ăn Nakydaco Can 25L', category: 'Dầu ăn & Bơ', unit: 'Can', cost_price: 650000, current_stock: 4, min_stock: 2, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 5, store_id: 1, code: 'NL05', name: 'Gạo thơm lài dẻo', category: 'Nông sản & Lương thực', unit: 'kg', cost_price: 22000, current_stock: 80.0, min_stock: 20, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 6, store_id: 1, code: 'NL06', name: 'Trà đen Phúc Long xuất khẩu', category: 'Trà & Cà phê', unit: 'gói 500g', cost_price: 85000, current_stock: 12, min_stock: 5, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 7, store_id: 1, code: 'NL07', name: 'Sữa đặc Phương Nam lon 1.28kg', category: 'Sữa & Kem', unit: 'Lon', cost_price: 62000, current_stock: 16, min_stock: 6, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 8, store_id: 1, code: 'NL08', name: 'Trân châu đen Đài Loan 3kg', category: 'Topping & Hạt', unit: 'Gói', cost_price: 95000, current_stock: 5, min_stock: 4, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 9, store_id: 1, code: 'NL09', name: 'Ly giấy OnesoftPOS 700ml kèm nắp', category: 'Bao bì & Ly hộp', unit: 'Cây 50 cái', cost_price: 48000, current_stock: 25, min_stock: 10, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 10, store_id: 1, code: 'NL10', name: 'Hộp giấy Kraft đựng gà rán', category: 'Bao bì & Ly hộp', unit: 'Cái', cost_price: 2500, current_stock: 350, min_stock: 100, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 11, store_id: 1, code: 'NL11', name: 'Tương ớt cay Cholimex can 2L', category: 'Gia vị & Bột', unit: 'Can', cost_price: 52000, current_stock: 3, min_stock: 5, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 12, store_id: 1, code: 'NL12', name: 'Bột phô mai lắc Tornado', category: 'Gia vị & Bột', unit: 'kg', cost_price: 160000, current_stock: 0, min_stock: 2, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 13, store_id: 2, code: 'EXP_GA', name: 'Đùi gà ướp sẵn chi nhánh Express', category: 'Thịt & Hải sản', unit: 'kg', cost_price: 65000, current_stock: 28.0, min_stock: 10, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
    { id: 14, store_id: 2, code: 'EXP_LY', name: 'Ly nhựa mang đi kèm màng ép', category: 'Bao bì & Ly hộp', unit: 'Cuộn', cost_price: 180000, current_stock: 6, min_stock: 2, is_active: true, created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' }
  ],
  inventory_transactions: [
    { id: 1, transaction_code: 'PN-20260915-001', store_id: 1, item_id: 1, transaction_type: 'IN', quantity: 50, price: 55000, total_amount: 2750000, stock_before: 0, stock_after: 50, user_id: 1, note: 'Nhập thịt gà tươi từ CP Foods', created_at: '2026-09-15T08:30:00Z' },
    { id: 2, transaction_code: 'PN-20260915-002', store_id: 1, item_id: 2, transaction_type: 'IN', quantity: 40, price: 68000, total_amount: 2720000, stock_before: 0, stock_after: 40, user_id: 1, note: 'Nhập đùi gà tỏi', created_at: '2026-09-15T09:00:00Z' },
    { id: 3, transaction_code: 'PX-20260917-001', store_id: 1, item_id: 1, transaction_type: 'OUT', quantity: 4.5, price: 55000, total_amount: 247500, stock_before: 50, stock_after: 45.5, user_id: 4, note: 'Xuất chế biến gà rán ca sáng', created_at: '2026-09-17T11:00:00Z' },
    { id: 4, transaction_code: 'PX-20260918-001', store_id: 1, item_id: 2, transaction_type: 'OUT', quantity: 8, price: 68000, total_amount: 544000, stock_before: 40, stock_after: 32, user_id: 4, note: 'Xuất đùi gà sốt cay Hàn Quốc', created_at: '2026-09-18T16:00:00Z' },
    { id: 5, transaction_code: 'PN-20260919-001', store_id: 1, item_id: 3, transaction_type: 'IN', quantity: 20, price: 35000, total_amount: 700000, stock_before: 0, stock_after: 20, user_id: 2, note: 'Nhập bột chiên giòn cay', created_at: '2026-09-19T09:30:00Z' },
    { id: 6, transaction_code: 'PX-20260919-002', store_id: 1, item_id: 3, transaction_type: 'OUT', quantity: 1.5, price: 35000, total_amount: 52500, stock_before: 20, stock_after: 18.5, user_id: 4, note: 'Xuất tẩm ướp gà', created_at: '2026-09-19T14:15:00Z' },
    { id: 7, transaction_code: 'PN-20260920-001', store_id: 1, item_id: 5, transaction_type: 'IN', quantity: 100, price: 22000, total_amount: 2200000, stock_before: 0, stock_after: 100, user_id: 2, note: 'Nhập 2 bao gạo thơm lài', created_at: '2026-09-20T07:30:00Z' },
    { id: 8, transaction_code: 'PX-20260920-002', store_id: 1, item_id: 5, transaction_type: 'OUT', quantity: 20, price: 22000, total_amount: 440000, stock_before: 100, stock_after: 80, user_id: 4, note: 'Nấu cơm gà phục vụ ca trưa', created_at: '2026-09-20T08:15:00Z' }
  ]
};

async function testConnection() {
  if (!pool) return false;
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT NOW() as current_time');
    const repairedPasswords = await client.query(
      `UPDATE users SET password_hash=$1, updated_at=CURRENT_TIMESTAMP
       WHERE username=ANY($2::varchar[]) AND password_hash=ANY($3::varchar[])`,
      [SEEDED_PASSWORD_HASH, ['admin', 'manager', 'cashier', 'kitchen', 'order'], LEGACY_INVALID_PASSWORD_HASHES]
    );
    if (repairedPasswords.rowCount) {
      console.log(`[Database Migration] Repaired ${repairedPasswords.rowCount} invalid seeded password hash(es).`);
    }
    await client.query(`CREATE TABLE IF NOT EXISTS role_features (
      role VARCHAR(30) NOT NULL,
      feature_code VARCHAR(50) NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role, feature_code)
    )`);
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS completed_items_enabled BOOLEAN DEFAULT NULL');
    await client.query(`CREATE TABLE IF NOT EXISTS sizes (
      id SERIAL PRIMARY KEY,
      store_id INT REFERENCES stores(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL,
      description TEXT,
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(store_id, name)
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS product_variants (
      id SERIAL PRIMARY KEY,
      product_id INT REFERENCES products(id) ON DELETE CASCADE,
      size_name VARCHAR(50) NOT NULL,
      price_adjustment NUMERIC(15, 2) DEFAULT 0,
      is_default BOOLEAN DEFAULT FALSE
    )`);
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id INT REFERENCES product_variants(id) ON DELETE SET NULL');
    await client.query(`CREATE TABLE IF NOT EXISTS store_role_features (
      store_id INT REFERENCES stores(id) ON DELETE CASCADE,
      role VARCHAR(30) NOT NULL,
      feature_code VARCHAR(50) NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (store_id, role, feature_code)
    )`);
    const optionGroupColumn = await client.query(`SELECT 1 FROM information_schema.columns
      WHERE table_name='product_options' AND column_name='group_id'`);
    await client.query(`CREATE TABLE IF NOT EXISTS topping_groups (
      id SERIAL PRIMARY KEY,
      store_id INT REFERENCES stores(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      UNIQUE(store_id,name)
    )`);
    await client.query('ALTER TABLE product_options ADD COLUMN IF NOT EXISTS group_id INT REFERENCES topping_groups(id) ON DELETE SET NULL');
    if (!optionGroupColumn.rowCount) {
      await client.query(`INSERT INTO topping_groups (store_id,name,description,sort_order,is_active)
        SELECT DISTINCT po.store_id,'Chưa phân nhóm','Nhóm tự động cho topping hiện có',999,TRUE
        FROM product_options po WHERE po.group_id IS NULL
        ON CONFLICT (store_id,name) DO NOTHING`);
      await client.query(`UPDATE product_options po SET group_id=tg.id
        FROM topping_groups tg
        WHERE po.group_id IS NULL AND tg.store_id=po.store_id AND tg.name='Chưa phân nhóm'`);
    }
    const optionProductTable = await client.query("SELECT to_regclass('public.product_option_products') AS table_name");
    await client.query(`CREATE TABLE IF NOT EXISTS product_option_products (
      option_id INT REFERENCES product_options(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id) ON DELETE CASCADE,
      PRIMARY KEY (option_id, product_id)
    )`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_product_option_products_product ON product_option_products(product_id)');
    if (!optionProductTable.rows[0]?.table_name) {
      await client.query(`INSERT INTO product_option_products (option_id, product_id)
        SELECT option.id, product.id FROM product_options option
        JOIN products product ON product.store_id=option.store_id
        ON CONFLICT DO NOTHING`);
    }
    await client.query(`WITH ranked_assignments AS (
      SELECT us.id, ROW_NUMBER() OVER (
        PARTITION BY us.user_id ORDER BY us.is_default DESC, us.store_id ASC
      ) AS assignment_rank
      FROM user_stores us JOIN users u ON u.id = us.user_id
      WHERE u.role = 'STORE_MANAGER'
    )
    DELETE FROM user_stores us USING ranked_assignments ranked
    WHERE us.id = ranked.id AND ranked.assignment_rank > 1`);
    await client.query(`CREATE OR REPLACE FUNCTION enforce_store_manager_single_store()
      RETURNS TRIGGER AS $$
      DECLARE target_user_id INT; target_role VARCHAR(30); assigned_store_count INT;
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
            RAISE EXCEPTION 'STORE_MANAGER % must be assigned to exactly one store', target_user_id USING ERRCODE = '23514';
          END IF;
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`);
    await client.query('DROP TRIGGER IF EXISTS trg_store_manager_user_assignment ON users');
    await client.query(`CREATE CONSTRAINT TRIGGER trg_store_manager_user_assignment
      AFTER INSERT OR UPDATE OF role ON users DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION enforce_store_manager_single_store()`);
    await client.query('DROP TRIGGER IF EXISTS trg_store_manager_store_assignment ON user_stores');
    await client.query(`CREATE CONSTRAINT TRIGGER trg_store_manager_store_assignment
      AFTER INSERT OR UPDATE OR DELETE ON user_stores DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION enforce_store_manager_single_store()`);
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_by INT REFERENCES users(id)');
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE');
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(30)');
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT');
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE');
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS prepared_by INT REFERENCES users(id) ON DELETE SET NULL');
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP WITH TIME ZONE');
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancelled_by INT REFERENCES users(id) ON DELETE SET NULL');
    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE');
    await client.query('CREATE INDEX IF NOT EXISTS idx_order_items_prepared_by ON order_items(prepared_by, prepared_at DESC)');
    await client.query("ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS kds_completion_message TEXT DEFAULT 'Món ăn {mon}, bàn {ban} đã xong'");
    await client.query('ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS takeaway_workspace_enabled BOOLEAN DEFAULT NULL');
    await client.query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS workflow_definition JSONB DEFAULT '{"name":"Thu ngân - Bếp - Thanh toán","steps":[{"id":"create","name":"Thu ngân tạo đơn","type":"CREATE","roles":["CASHIER"]},{"id":"kitchen","name":"Bếp chế biến","type":"KITCHEN","roles":["KITCHEN"]},{"id":"payment","name":"Thu ngân thanh toán","type":"PAYMENT","roles":["CASHIER"]}]}'::jsonb`);
    await client.query('ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS admin_tabs JSONB DEFAULT NULL');
    await client.query('ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS inventory_transactions_enabled BOOLEAN DEFAULT TRUE');
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS workflow_stage_index INT DEFAULT 0');
    await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS workflow_snapshot JSONB');
    const legacyWorkflow = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='order_workflow'`);
    if (legacyWorkflow.rows.length) {
      await client.query(`UPDATE store_settings SET workflow_definition='{"name":"Order - Thu ngân - Bếp - Thanh toán","steps":[{"id":"create","name":"Nhân viên Order tạo đơn","type":"CREATE","roles":["ORDER_STAFF"]},{"id":"cashier_confirm","name":"Thu ngân xác nhận","type":"APPROVAL","roles":["CASHIER","STORE_MANAGER","ADMIN"]},{"id":"kitchen","name":"Bếp chế biến","type":"KITCHEN","roles":["KITCHEN"]},{"id":"payment","name":"Thu ngân thanh toán","type":"PAYMENT","roles":["CASHIER"]}]}'::jsonb WHERE order_workflow='ORDER_CASHIER_KITCHEN_PAYMENT'`);
      await client.query('ALTER TABLE store_settings DROP COLUMN order_workflow');
    }
    await client.query(`CREATE TABLE IF NOT EXISTS inventory_items (
      id SERIAL PRIMARY KEY,
      store_id INT REFERENCES stores(id) ON DELETE CASCADE,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(150) NOT NULL,
      category VARCHAR(100) DEFAULT 'Nguyên liệu',
      unit VARCHAR(30) NOT NULL DEFAULT 'kg',
      cost_price NUMERIC(15, 2) DEFAULT 0,
      current_stock NUMERIC(15, 3) DEFAULT 0,
      min_stock NUMERIC(15, 3) DEFAULT 5,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(store_id, code)
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS inventory_transactions (
      id SERIAL PRIMARY KEY,
      transaction_code VARCHAR(50) NOT NULL,
      store_id INT REFERENCES stores(id) ON DELETE CASCADE,
      item_id INT REFERENCES inventory_items(id) ON DELETE CASCADE,
      transaction_type VARCHAR(20) NOT NULL,
      quantity NUMERIC(15, 3) NOT NULL,
      price NUMERIC(15, 2) DEFAULT 0,
      total_amount NUMERIC(15, 2) DEFAULT 0,
      stock_before NUMERIC(15, 3) DEFAULT 0,
      stock_after NUMERIC(15, 3) DEFAULT 0,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_inventory_items_store ON inventory_items(store_id, is_active)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_inventory_trans_store_created ON inventory_transactions(store_id, created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_inventory_trans_item ON inventory_transactions(item_id)');

    const itemCountRes = await client.query('SELECT COUNT(*) as count FROM inventory_items');
    // Demo inventory must never be inserted into deleted or unrelated stores.
    const demoStores = await client.query('SELECT id,code FROM stores');
    const demoUsers = await client.query('SELECT id,username FROM users');
    const canSeedDemoInventory = memoryStore.stores.every(sample => demoStores.rows.some(store => store.id === sample.id && store.code === sample.code))
      && memoryStore.inventory_transactions.every(sample => demoUsers.rows.some(user => user.id === sample.user_id && user.username === memoryStore.users.find(item => item.id === sample.user_id)?.username));
    if (parseInt(itemCountRes.rows[0].count, 10) === 0 && canSeedDemoInventory) {
      for (const item of memoryStore.inventory_items) {
        await client.query(
          `INSERT INTO inventory_items (id, store_id, code, name, category, unit, cost_price, current_stock, min_stock, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [item.id, item.store_id, item.code, item.name, item.category, item.unit, item.cost_price, item.current_stock, item.min_stock, item.is_active]
        );
      }
      await client.query("SELECT setval(pg_get_serial_sequence('inventory_items', 'id'), coalesce(max(id), 1)) FROM inventory_items");

      for (const t of memoryStore.inventory_transactions) {
        await client.query(
          `INSERT INTO inventory_transactions (id, transaction_code, store_id, item_id, transaction_type, quantity, price, total_amount, stock_before, stock_after, user_id, note, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [t.id, t.transaction_code, t.store_id, t.item_id, t.transaction_type, t.quantity, t.price, t.total_amount, t.stock_before, t.stock_after, t.user_id, t.note, t.created_at]
        );
      }
      await client.query("SELECT setval(pg_get_serial_sequence('inventory_transactions', 'id'), coalesce(max(id), 1)) FROM inventory_transactions");
      console.log('[Database Migration] Seeded initial inventory items and transactions.');
    }
    await client.query(`INSERT INTO role_features (role, feature_code, enabled) VALUES
      ('ADMIN','POS',TRUE),('ADMIN','TABLES',TRUE),('ADMIN','KDS',TRUE),('ADMIN','ORDERS',TRUE),('ADMIN','HISTORY',TRUE),('ADMIN','PAYMENT',TRUE),('ADMIN','ADMIN',TRUE),('ADMIN','SHIFT',TRUE),('ADMIN','DISCOUNT',TRUE),('ADMIN','COMPLETED_ITEMS',TRUE),('ADMIN','INVENTORY',TRUE),
      ('STORE_MANAGER','POS',TRUE),('STORE_MANAGER','TABLES',TRUE),('STORE_MANAGER','KDS',TRUE),('STORE_MANAGER','ORDERS',TRUE),('STORE_MANAGER','HISTORY',TRUE),('STORE_MANAGER','PAYMENT',TRUE),('STORE_MANAGER','ADMIN',TRUE),('STORE_MANAGER','SHIFT',TRUE),('STORE_MANAGER','DISCOUNT',TRUE),('STORE_MANAGER','COMPLETED_ITEMS',TRUE),('STORE_MANAGER','INVENTORY',TRUE),
      ('ORDER_STAFF','POS',TRUE),('ORDER_STAFF','TABLES',TRUE),('ORDER_STAFF','KDS',FALSE),('ORDER_STAFF','ORDERS',TRUE),('ORDER_STAFF','HISTORY',TRUE),('ORDER_STAFF','PAYMENT',FALSE),('ORDER_STAFF','ADMIN',FALSE),('ORDER_STAFF','SHIFT',FALSE),('ORDER_STAFF','DISCOUNT',FALSE),('ORDER_STAFF','COMPLETED_ITEMS',TRUE),
      ('CASHIER','POS',TRUE),('CASHIER','TABLES',TRUE),('CASHIER','KDS',FALSE),('CASHIER','ORDERS',TRUE),('CASHIER','HISTORY',TRUE),('CASHIER','PAYMENT',TRUE),('CASHIER','ADMIN',FALSE),('CASHIER','SHIFT',TRUE),('CASHIER','DISCOUNT',TRUE),('CASHIER','COMPLETED_ITEMS',TRUE),
      ('KITCHEN','POS',FALSE),('KITCHEN','TABLES',FALSE),('KITCHEN','KDS',TRUE),('KITCHEN','ORDERS',FALSE),('KITCHEN','HISTORY',TRUE),('KITCHEN','PAYMENT',FALSE),('KITCHEN','ADMIN',FALSE),('KITCHEN','SHIFT',FALSE),('KITCHEN','DISCOUNT',FALSE),('KITCHEN','COMPLETED_ITEMS',FALSE)
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
}
