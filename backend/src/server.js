const express = require('express');
const cors = require('cors');
const path = require('path');

// Only load dotenv locally — on Vercel, env vars come from the dashboard
if (!process.env.VERCEL) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const authRouter = require('./routes/auth');
const studentsRouter = require('./routes/students');
const analyticsRouter = require('./routes/analytics');
const placementsRouter = require('./routes/placements');
const batchesRouter = require('./routes/batches');
const uploadRouter = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (if needed)
const uploadsPath = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Debug endpoint (no DB) - for troubleshooting
app.get('/api/ping', (req, res) => {
  res.json({
    ping: 'pong',
    env: process.env.VERCEL ? 'vercel' : 'local',
    hasDbUrl: !!process.env.DATABASE_URL,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/students', studentsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/placements', placementsRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/upload', uploadRouter);

app.get('/api/health', async (req, res) => {
  try {
    const pool = require('./config/db');
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'failed', error: err.message });
  }
});

// Error handler for multer
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Max 10MB allowed.' });
  }
  if (err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// If started directly (node src/server.js), listen on the port. When imported (serverless), just export the app.
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log('');
    console.log('┌────────────────────────────────────────────┐');
    console.log(`│  ✅  Server running on http://localhost:${PORT}  │`);
    console.log('│  Press Ctrl+C to stop                      │');
    console.log('└────────────────────────────────────────────┘');
    console.log('');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Kill the existing process or use a different port.`);
    } else {
      console.error('❌ Server error:', err);
    }
    process.exit(1);
  });
}

// Export the app so it can be wrapped as a serverless function (Vercel)
module.exports = app;

// Catch unhandled errors so the server never silently dies
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});
