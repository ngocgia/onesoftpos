const express = require('express');
const router = express.Router();

const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');
const storeController = require('../controllers/storeController');
const productController = require('../controllers/productController');
const tableController = require('../controllers/tableController');
const orderController = require('../controllers/orderController');
const paymentController = require('../controllers/paymentController');
const kdsController = require('../controllers/kdsController');
const shiftController = require('../controllers/shiftController');
const reportController = require('../controllers/reportController');

// 1. Auth routes
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticateToken, authController.getMe);

// 2. Store & Store Types routes
router.get('/stores', authenticateToken, storeController.getStores);
router.get('/stores/:id', authenticateToken, storeController.getStoreDetails);
router.post('/stores', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), storeController.createStore);
router.put('/stores/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), storeController.updateStore);
router.put('/stores/:id/settings', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), storeController.updateStoreSettings);

router.get('/store-types', authenticateToken, storeController.getStoreTypes);
router.put('/store-types/:id/features', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), storeController.updateStoreTypeFeature);

// 3. Category & Product routes
router.get('/categories', authenticateToken, productController.getCategories);
router.post('/categories', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), productController.createCategory);

router.get('/products', authenticateToken, productController.getProducts);
router.post('/products', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), productController.createProduct);
router.get('/products/options', authenticateToken, productController.getOptions);

// 4. Area & Table routes (Dine-in)
router.get('/areas', authenticateToken, tableController.getAreas);
router.get('/tables', authenticateToken, tableController.getTables);
router.put('/tables/:id/status', authenticateToken, tableController.updateTableStatus);
router.post('/tables/transfer', authenticateToken, tableController.transferTable);
router.post('/tables/merge', authenticateToken, tableController.mergeTables);

// 5. Order routes
router.get('/orders', authenticateToken, orderController.getOrders);
router.get('/orders/:id', authenticateToken, orderController.getOrderById);
router.post('/orders', authenticateToken, orderController.createOrder);
router.put('/orders/:id/status', authenticateToken, orderController.updateOrderStatus);
router.post('/orders/:id/split', authenticateToken, orderController.splitOrder);

// 6. Payment & VietQR routes
router.post('/payments/process', authenticateToken, paymentController.processPayment);
router.get('/payments/vietqr/:orderId', authenticateToken, paymentController.getVietQR);

// 7. KDS routes
router.get('/kds/orders', authenticateToken, kdsController.getKdsOrders);
router.put('/kds/items/:itemId/status', authenticateToken, kdsController.updateKdsItemStatus);

// 8. Shift routes
router.get('/shifts/current', authenticateToken, shiftController.getCurrentShift);
router.post('/shifts/open', authenticateToken, shiftController.openShift);
router.post('/shifts/:id/close', authenticateToken, shiftController.closeShift);

// 9. Report routes
router.get('/reports/summary', authenticateToken, reportController.getSummary);

module.exports = router;
