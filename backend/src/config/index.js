// Centralized configuration for backend
require('dotenv').config();

const config = {
  db: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    url: process.env.DATABASE_URL || null,
  },
  jwtSecret: process.env.JWT_SECRET || 'placement-analytics-secret-key-change-in-production',
};

module.exports = config;
