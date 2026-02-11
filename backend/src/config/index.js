const path = require('path');

// Only load dotenv locally — on Vercel, env vars come from the dashboard
if (!process.env.VERCEL) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
}

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  port: process.env.PORT || 5000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
