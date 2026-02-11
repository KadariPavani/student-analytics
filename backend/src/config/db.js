const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// In serverless environments, avoid creating a new pool on every invocation.
// Reuse the pool across warm starts by storing it on the global object.
const isServerless = !!process.env.VERCEL;

let poolConfig;

if (process.env.DATABASE_URL) {
  // Single connection string (Neon, Supabase, Railway, etc.)
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: isServerless ? 2 : 20,
    idleTimeoutMillis: isServerless ? 10000 : 30000,
    connectionTimeoutMillis: 5000,
  };
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'student_analytics',
    max: isServerless ? 2 : 20,
    idleTimeoutMillis: isServerless ? 10000 : 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  };
}

if (!global.__pgPool) {
  global.__pgPool = new Pool(poolConfig);
  global.__pgPool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
}

module.exports = global.__pgPool;
