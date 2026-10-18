const express = require('express');
const path = require('node:path');
const { ApkRepository } = require('../services/apkRepository');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { audit } = require('../middleware/auditMiddleware');

const repository = new ApkRepository(process.env.APK_STORAGE_DIR || path.join(__dirname, '../../data/apks'));
const wrap = handler => async (req, res, next) => {
  try { await handler(req, res, next); }
  catch (error) {
    if (res.headersSent || res.destroyed) return;
    if (!error.status) console.error('APK error:', error.message);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Không thể xử lý file APK' });
  }
};

const adminRouter = express.Router();
adminRouter.use(authenticateToken, requireRole(['ADMIN']));
adminRouter.get('/', wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, releases: await repository.list() });
}));
adminRouter.post('/', audit('UPLOAD', 'APK'), wrap(async (req, res) => {
  if (!['true', 'false'].includes(req.get('X-Apk-Enabled')) || !['true', 'false'].includes(req.get('X-Apk-Default'))) {
    return res.status(400).json({ success: false, message: 'Thiếu cấu hình cho phép tải hoặc phiên bản mặc định' });
  }
  let filename;
  try { filename = decodeURIComponent(req.get('X-Apk-Filename') || ''); }
  catch { return res.status(400).json({ success: false, message: 'Tên file không hợp lệ' }); }
  const release = await repository.upload(req, {
    version: req.get('X-Apk-Version'), filename,
    enabled: req.get('X-Apk-Enabled') === 'true', isDefault: req.get('X-Apk-Default') === 'true',
    uploadedBy: req.user.id, contentLength: req.get('Content-Length')
  });
  res.status(201).json({ success: true, release });
}));
adminRouter.put('/:id', audit('UPDATE', 'APK'), wrap(async (req, res) => {
  await repository.update(req.params.id, req.body);
  res.json({ success: true });
}));
adminRouter.delete('/:id', audit('DELETE', 'APK'), wrap(async (req, res) => {
  await repository.remove(req.params.id);
  res.json({ success: true });
}));

const download = wrap(async (req, res, next) => {
  if (req.query.version !== undefined && typeof req.query.version !== 'string') {
    return res.status(400).json({ success: false, message: 'Phiên bản không hợp lệ' });
  }
  const item = await repository.download(req.query.version);
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'application/vnd.android.package-archive' });
  res.download(item.file, item.filename, error => {
    if (error && !res.headersSent) res.status(404).end('File APK hiện không khả dụng');
    else if (error) next(error);
  });
});
module.exports = { adminRouter, download };
