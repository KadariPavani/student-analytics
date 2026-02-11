const { Pool } = require('pg');
require('dotenv').config();

// In serverless environments, avoid creating a new pool on every invocation.
// Reuse the pool across warm starts by storing it on the global object.
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'student_analytics',
  // Serverless-friendly: keep pool small, short timeouts
  max: process.env.VERCEL ? 2 : 20,
  idleTimeoutMillis: process.env.VERCEL ? 10000 : 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

if (!global.__pgPool) {
  global.__pgPool = new Pool(poolConfig);
  global.__pgPool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
}

module.exports = global.__pgPool;
