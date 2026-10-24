const express = require('express');
const path = require('node:path');
const router = express.Router();
const root = path.join(__dirname, '../../../public');
router.get(['/', '/index.html'], (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(root, req.query.mode === 'pos' ? 'index.html' : 'landing.html'));
});
router.get('/pos', (req, res) => res.redirect('/?mode=pos'));
module.exports = router;
