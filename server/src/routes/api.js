const express = require('express');
const router = express.Router();

const { authenticateToken, requireRole, requireFeature } = require('../middleware/authMiddleware');
const { audit } = require('../middleware/auditMiddleware');
const authController = require('../controllers/authController');
const storeController = require('../controllers/storeController');
const productController = require('../controllers/productController');
const tableController = require('../controllers/tableController');
const orderController = require('../controllers/orderController');
const paymentController = require('../controllers/paymentController');
const kdsController = require('../controllers/kdsController');
const shiftController = require('../controllers/shiftController');
const reportController = require('../controllers/reportController');
const adminController = require('../controllers/adminController');

// 1. Auth routes
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticateToken, authController.getMe);

// 2. Store & Store Types routes
router.get('/stores', authenticateToken, storeController.getStores);
router.get('/stores/:id', authenticateToken, storeController.getStoreDetails);
router.post('/stores', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), audit('CREATE', 'STORE'), storeController.createStore);
router.put('/stores/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), audit('UPDATE', 'STORE'), storeController.updateStore);
router.put('/stores/:id/settings', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), audit('UPDATE_SETTINGS', 'STORE'), storeController.updateStoreSettings);

router.get('/store-types', authenticateToken, storeController.getStoreTypes);
router.post('/store-types', authenticateToken, requireRole(['SUPER_ADMIN']), audit('CREATE', 'STORE_TYPE'), storeController.createStoreType);
router.put('/store-types/:id', authenticateToken, requireRole(['SUPER_ADMIN']), audit('UPDATE', 'STORE_TYPE'), storeController.updateStoreType);
router.put('/store-types/:id/features', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), audit('UPDATE_FEATURE', 'STORE_TYPE'), storeController.updateStoreTypeFeature);

// 3. Category & Product routes
router.get('/categories', authenticateToken, productController.getCategories);
router.post('/categories', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), audit('CREATE', 'CATEGORY'), productController.createCategory);

router.get('/products', authenticateToken, productController.getProducts);
router.post('/products', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), audit('CREATE', 'PRODUCT'), productController.createProduct);
router.put('/products/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), audit('UPDATE', 'PRODUCT'), productController.updateProduct);
router.get('/products/options', authenticateToken, productController.getOptions);

// 4. Area & Table routes (Dine-in)
router.get('/areas', authenticateToken, requireFeature('TABLES'), tableController.getAreas);
router.get('/tables', authenticateToken, requireFeature('TABLES'), tableController.getTables);
router.put('/tables/:id/status', authenticateToken, requireFeature('TABLES'), tableController.updateTableStatus);
router.post('/tables/transfer', authenticateToken, requireFeature('TABLES'), tableController.transferTable);
router.post('/tables/merge', authenticateToken, requireFeature('TABLES'), tableController.mergeTables);

// 5. Order routes
router.get('/orders', authenticateToken, requireFeature('ORDERS'), orderController.getOrders);
router.get('/orders/:id', authenticateToken, requireFeature('ORDERS'), orderController.getOrderById);
router.post('/orders', authenticateToken, requireFeature('POS'), orderController.createOrder);
router.put('/orders/:id/status', authenticateToken, requireFeature('ORDERS'), orderController.updateOrderStatus);
router.post('/orders/:id/advance', authenticateToken, requireFeature('ORDERS'), orderController.advanceOrderWorkflow);
router.post('/orders/:id/split', authenticateToken, requireFeature('ORDERS'), orderController.splitOrder);

// 6. Payment & VietQR routes
router.post('/payments/process', authenticateToken, requireFeature('PAYMENT'), paymentController.processPayment);
router.get('/payments/vietqr/:orderId', authenticateToken, requireFeature('PAYMENT'), paymentController.getVietQR);

// 7. KDS routes
router.get('/kds/orders', authenticateToken, requireFeature('KDS'), kdsController.getKdsOrders);
router.put('/kds/items/:itemId/status', authenticateToken, requireFeature('KDS'), kdsController.updateKdsItemStatus);

// 8. Shift routes
router.get('/shifts/current', authenticateToken, requireFeature('SHIFT'), shiftController.getCurrentShift);
router.post('/shifts/open', authenticateToken, requireFeature('SHIFT'), shiftController.openShift);
router.post('/shifts/:id/close', authenticateToken, requireFeature('SHIFT'), shiftController.closeShift);

// 9. Report routes
router.get('/reports/summary', authenticateToken, reportController.getSummary);

// 10. Dedicated Super Admin routes
router.get('/admin/dashboard', authenticateToken, requireRole(['SUPER_ADMIN']), adminController.dashboard);
router.get('/admin/users', authenticateToken, requireRole(['SUPER_ADMIN']), adminController.getUsers);
router.post('/admin/users', authenticateToken, requireRole(['SUPER_ADMIN']), audit('CREATE', 'USER'), adminController.createUser);
router.put('/admin/users/:id', authenticateToken, requireRole(['SUPER_ADMIN']), audit('UPDATE', 'USER'), adminController.updateUser);
router.get('/admin/audit-logs', authenticateToken, requireRole(['SUPER_ADMIN']), adminController.getAuditLogs);
router.get('/admin/role-features', authenticateToken, requireRole(['SUPER_ADMIN']), adminController.getRoleFeatures);
router.put('/admin/role-features/:role', authenticateToken, requireRole(['SUPER_ADMIN']), audit('UPDATE_FEATURE', 'ROLE'), adminController.updateRoleFeature);

module.exports = router;
