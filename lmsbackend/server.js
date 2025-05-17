const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool, testConnection, initDatabase, getStats, getCategories, addCategory } = require('./config/db');
const { isLibrarian } = require('./middleware/authMiddleware');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// --- CORS Setup ---
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://127.0.0.1:5500',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Added 'Authorization' to allowed headers
};
app.use(cors(corsOptions));

// --- Middleware Setup ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Static File Handling ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📂 Uploads directory created:', uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// --- Database Connection ---
(async () => {
  try {
    const dbConnected = await testConnection();
    if (dbConnected) {
      await initDatabase();
    } else {
      console.error('❌ Database initialization failed. Exiting...');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error during database initialization:', error.message);
    process.exit(1);
  }
})();

// --- File Upload (Cover + QR) Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, fileName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max file size 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const isValid = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
    cb(null, isValid || new Error('Only image files are allowed!'));
  },
});

// --- Routes Setup ---
const bookRoutes = require('./routes/bookRoutes');
app.use('/api/books', bookRoutes);

// --- Categories Routes ---
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await getCategories();
    res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error('❌ Error fetching categories:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
    });
  }
});

// Modified to allow category addition without librarian check for demo purposes
// You should restore the isLibrarian middleware in production
app.post('/api/categories', async (req, res) => {
  const { category } = req.body;

  if (!category) {
    return res.status(400).json({
      success: false,
      message: 'Category name is required',
    });
  }

  try {
    const result = await addCategory(category);
    res.status(201).json(result);
  } catch (error) {
    console.error('❌ Error adding category:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to add category',
    });
  }
});

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
  console.log('✅ Health check passed');
});

// --- Dashboard Stats ---
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await getStats();
    console.log('📊 Dashboard stats fetched successfully:', stats);
    res.json({ success: true, ...stats });
  } catch (error) {
    console.error('❌ Error fetching stats:', error.message);
    res.status(500).json({ success: false, message: 'Error fetching stats' });
  }
});

// --- 404 + Error Handling ---
app.use((req, res) => {
  console.warn('❌ Route not found:', req.originalUrl);
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({ success: false, message: 'Server error: ' + err.message });
});

// --- Graceful Shutdown ---
process.on('SIGINT', async () => {
  console.log('\n🛑 Gracefully shutting down...');
  try {
    await pool.end();
    console.log('✅ Database connection pool closed');
  } catch (error) {
    console.error('❌ Error closing database connection pool:', error.message);
  }
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});