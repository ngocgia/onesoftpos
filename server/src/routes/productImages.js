const express = require('express');
const { authenticateToken, requireRole, requireStoreContext } = require('../middleware/authMiddleware');
const { audit } = require('../middleware/auditMiddleware');
const { saveImage } = require('../services/productImages');

const router = express.Router();
router.post('/', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'STORE_MANAGER']), requireStoreContext(),
  express.json({ limit: '2mb' }), audit('UPLOAD', 'PRODUCT_IMAGE'), async (req, res) => {
    try {
      const image_url = await saveImage(req.storeId, req.body?.image);
      // Keep image bytes out of the audit log.
      req.body = { image_url };
      res.status(201).json({ success: true, image_url });
    } catch (error) {
      if (!error.status) console.error('Product image upload error:', error.message);
      res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Không thể lưu ảnh món ăn. Vui lòng thử lại.' });
    }
  });
router.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'Ảnh tải lên vượt quá dung lượng cho phép' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Dữ liệu tải ảnh không hợp lệ' });
  next(error);
});

module.exports = router;
