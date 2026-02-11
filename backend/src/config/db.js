const { Pool } = require('pg');
require('dotenv').config();

// In serverless environments, avoid creating a new pool on every invocation.
// Reuse the pool across module reloads by storing it on the global object.
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'student_analytics',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

if (!global.__pgPool) {
  global.__pgPool = new Pool(poolConfig);
  global.__pgPool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    // Do not exit; let serverless provider manage restarts.
  });
}

module.exports = global.__pgPool;
