const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { testConnection } = require('./config/db');
const apiRoutes = require('./routes/api');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));

// Mount REST API
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), system: 'ThichGaPOS v1.0' });
});

// SPA fallback: any other request goes to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start server
app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🚀 ThichGaPOS Server running on http://localhost:${PORT}`);
  console.log(`📱 Frontend Mobile-First UI: http://localhost:${PORT}`);
  console.log(`⚡ API Documentation & Health: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
  
  // Test PostgreSQL connection
  await testConnection();
});
