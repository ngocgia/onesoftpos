const express = require('express');
const router = express.Router();

const { authenticateToken, requireRole, requireFeature, requireStoreAccess, requireStoreContext } = require('../middleware/authMiddleware');
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
const storeStaffController = require('../controllers/storeStaffController');

// 1. Auth routes
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticateToken, authController.getMe);

// 2. Store & Store Types routes
router.get('/stores', authenticateToken, storeController.getStores);
router.get('/stores/:id', authenticateToken, requireStoreAccess(), storeController.getStoreDetails);
router.post('/stores', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), audit('CREATE', 'STORE'), storeController.createStore);
router.put('/stores/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreAccess(), audit('UPDATE', 'STORE'), storeController.updateStore);
router.delete('/stores/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), requireStoreAccess(), audit('DELETE', 'STORE'), storeController.deleteStore);
router.put('/stores/:id/settings', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreAccess(), audit('UPDATE_SETTINGS', 'STORE'), storeController.updateStoreSettings);

router.get('/store-types', authenticateToken, storeController.getStoreTypes);
router.post('/store-types', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), audit('CREATE', 'STORE_TYPE'), storeController.createStoreType);
router.put('/store-types/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), audit('UPDATE', 'STORE_TYPE'), storeController.updateStoreType);
router.delete('/store-types/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), audit('DELETE', 'STORE_TYPE'), storeController.deleteStoreType);
router.put('/store-types/:id/features', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), audit('UPDATE_FEATURE', 'STORE_TYPE'), storeController.updateStoreTypeFeature);

// 3. Category & Product routes
router.get('/categories', authenticateToken, productController.getCategories);
router.post('/categories', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('CREATE', 'CATEGORY'), productController.createCategory);
router.put('/categories/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('UPDATE', 'CATEGORY'), productController.updateCategory);
router.delete('/categories/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('DELETE', 'CATEGORY'), productController.deleteCategory);

router.get('/products', authenticateToken, productController.getProducts);
router.post('/products', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('CREATE', 'PRODUCT'), productController.createProduct);
router.put('/products/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('UPDATE', 'PRODUCT'), productController.updateProduct);
router.delete('/products/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('DELETE', 'PRODUCT'), productController.deleteProduct);
router.put('/products/:id/toppings', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('UPDATE_TOPPINGS', 'PRODUCT'), productController.updateProductToppings);
router.get('/products/options', authenticateToken, productController.getOptions);

router.get('/toppings', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), productController.getToppings);
router.get('/topping-groups', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), productController.getToppingGroups);
router.post('/topping-groups', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('CREATE', 'TOPPING_GROUP'), productController.createToppingGroup);
router.put('/topping-groups/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('UPDATE', 'TOPPING_GROUP'), productController.updateToppingGroup);
router.delete('/topping-groups/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), requireStoreContext(), audit('DELETE', 'TOPPING_GROUP'), productController.deleteToppingGroup);
router.post('/toppings', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('CREATE', 'TOPPING'), productController.createTopping);
router.put('/toppings/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('UPDATE', 'TOPPING'), productController.updateTopping);
router.delete('/toppings/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), requireStoreContext(), audit('DELETE', 'TOPPING'), productController.deleteTopping);

// 3.1 Store manager: staff accounts and per-store permissions
router.get('/store/staff', authenticateToken, requireRole(['STORE_MANAGER']), requireStoreContext(), storeStaffController.getStaff);
router.post('/store/staff', authenticateToken, requireRole(['STORE_MANAGER']), requireStoreContext(), audit('CREATE', 'STORE_STAFF'), storeStaffController.createStaff);
router.put('/store/staff/:id', authenticateToken, requireRole(['STORE_MANAGER']), requireStoreContext(), audit('UPDATE', 'STORE_STAFF'), storeStaffController.updateStaff);
router.put('/store/staff/:id/reset-password', authenticateToken, requireRole(['STORE_MANAGER']), requireStoreContext(), audit('RESET_PASSWORD', 'STORE_STAFF'), storeStaffController.resetPassword);
router.get('/store/role-features', authenticateToken, requireRole(['STORE_MANAGER']), requireStoreContext(), storeStaffController.getStoreRoleFeatures);
router.put('/store/role-features/:role', authenticateToken, requireRole(['STORE_MANAGER']), requireStoreContext(), audit('UPDATE_FEATURE', 'STORE_ROLE'), storeStaffController.updateStoreRoleFeature);

// 4. Area & Table routes (Dine-in)
router.get('/areas', authenticateToken, requireFeature('TABLES'), tableController.getAreas);
router.post('/areas', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('CREATE', 'AREA'), tableController.createArea);
router.put('/areas/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('UPDATE', 'AREA'), tableController.updateArea);
router.delete('/areas/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('DELETE', 'AREA'), tableController.deleteArea);
router.get('/tables', authenticateToken, requireFeature('TABLES'), tableController.getTables);
router.post('/tables', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('CREATE', 'TABLE'), tableController.createTable);
router.put('/tables/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('UPDATE', 'TABLE'), tableController.updateTable);
router.delete('/tables/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(), audit('DELETE', 'TABLE'), tableController.deleteTable);
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
router.get('/kds/history', authenticateToken, requireFeature('HISTORY'), kdsController.getKdsHistory);
router.get('/kds/completed-items', authenticateToken, requireStoreContext(), requireFeature('COMPLETED_ITEMS'), kdsController.getCompletedItems);
router.put('/kds/items/:itemId/status', authenticateToken, requireFeature('KDS'), kdsController.updateKdsItemStatus);

// 8. Shift routes
router.get('/shifts/current', authenticateToken, requireFeature('SHIFT'), shiftController.getCurrentShift);
router.post('/shifts/open', authenticateToken, requireFeature('SHIFT'), shiftController.openShift);
router.post('/shifts/:id/close', authenticateToken, requireFeature('SHIFT'), shiftController.closeShift);

// 9. Report routes
router.get('/reports/summary', authenticateToken, reportController.getSummary);

// 10. Dedicated Super Admin routes
router.get('/admin/dashboard', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), adminController.dashboard);
router.get('/admin/users', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), adminController.getUsers);
router.post('/admin/users', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), audit('CREATE', 'USER'), adminController.createUser);
router.put('/admin/users/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), audit('UPDATE', 'USER'), adminController.updateUser);
router.delete('/admin/users/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), audit('DELETE', 'USER'), adminController.deleteUser);
router.get('/admin/audit-logs', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), adminController.getAuditLogs);
router.delete('/admin/audit-logs', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), adminController.clearAuditLogs);
router.get('/admin/role-features', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), adminController.getRoleFeatures);
router.put('/admin/role-features/:role', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), audit('UPDATE_FEATURE', 'ROLE'), adminController.updateRoleFeature);

module.exports = router;
