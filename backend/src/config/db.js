const path = require('path');

// Only load dotenv locally — on Vercel, env vars come from the dashboard
if (!process.env.VERCEL) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
}

const isServerless = !!process.env.VERCEL;

let pool;

if (isServerless && process.env.DATABASE_URL) {
  // Use Neon's serverless driver on Vercel (WebSocket-based, handles cold starts)
  const { Pool: NeonPool, neonConfig } = require('@neondatabase/serverless');
  const ws = require('ws');
  
  // Configure WebSocket for Node.js (Vercel uses Node runtime)
  neonConfig.webSocketConstructor = ws;
  neonConfig.fetchConnectionCache = true;
  
  if (!global.__neonPool) {
    global.__neonPool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  }
  pool = global.__neonPool;
} else {
  // Use standard pg driver locally
  const { Pool } = require('pg');
  
  let poolConfig;
  if (process.env.DATABASE_URL) {
    poolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  } else {
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'student_analytics',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    };
  }

  if (!global.__pgPool) {
    global.__pgPool = new Pool(poolConfig);
    global.__pgPool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  pool = global.__pgPool;
}

module.exports = pool;
