const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { testConnection } = require('./config/db');
const apiRoutes = require('./routes/api');
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec, swaggerUiOptions } = require('./docs/swagger');

dotenv.config();
const apkRoutes = require('./routes/apks');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use('/api/product-images', require('./routes/productImages'));
// Printer settings include the resized QR image; other JSON endpoints keep their default limit.
app.use('/api/store/menu-settings/printer', express.json({ limit: '3mb' }));
app.use('/api/products/extract-from-image', express.json({ limit: '10mb' }));
app.use('/api/products/batch', express.json({ limit: '5mb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger OpenAPI Documentation
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Serve static frontend files
const publicPath = path.join(__dirname, '../../public');
app.use('/uploads/products', express.static(require('./services/productImages').imageDirectory, {
  index: false, dotfiles: 'deny', fallthrough: false, maxAge: '1y', immutable: true,
  setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff')
}), (error, req, res, next) => res.status(error.status || 500).end());
app.use(require('./routes/siteEntry'));
app.use(express.static(publicPath));

// Mount REST API
app.use('/api', apiRoutes);
app.use('/api/admin/apks', apkRoutes.adminRouter);
app.get('/download', apkRoutes.download);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), system: 'OnesoftPOS v1.0' });
});

// SPA fallback: any other request goes to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start server after the configured database is ready.
async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Copy server/.env.example to server/.env and set a long random secret.');
  }
  const connected = await testConnection();
  if (connected) await require('./db/menuPreferences').ensureMenuPreferences(require('./config/db').pool);
  if (process.env.DB_CLIENT === 'mysql' && !connected) {
    throw new Error('MySQL is unavailable. Run npm run db:init after configuring server/.env.');
  }
  const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 OnesoftPOS Server running on http://localhost:${PORT}`);
  console.log(`📱 Frontend Mobile-First UI: http://localhost:${PORT}`);
  console.log(`📑 Swagger API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`⚡ Raw OpenAPI Specification: http://localhost:${PORT}/api-docs.json`);
  console.log(`⚡ API Health Check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
  
  });

  server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Cổng ${PORT} hiện đang bị chiếm dụng bởi một tiến trình khác.`);
    console.error(`💡 Gợi ý: Hãy giải phóng cổng ${PORT} hoặc thay đổi PORT trong file server/.env.`);
  } else {
    console.error('❌ Server error:', err.message);
  }
  process.exit(1);
  });
}

start().catch(error => { console.error(error.message); process.exitCode = 1; });
