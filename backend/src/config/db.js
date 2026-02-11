const path = require('path');

// Only load dotenv locally — on Vercel, env vars come from the dashboard
if (!process.env.VERCEL) {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
}

const isServerless = !!process.env.VERCEL;

let pool = null;

// Lazy getter - only create pool when first used
function getPool() {
  if (pool) return pool;

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set!');
    throw new Error('DATABASE_URL environment variable is required');
  }

  if (isServerless) {
    // Use Neon's serverless driver with HTTP (not WebSocket) for simpler cold starts
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    
    // Create a pool-like interface that uses HTTP queries
    pool = {
      query: async (text, params) => {
        try {
          const rows = await sql(text, params || []);
          return { rows, rowCount: rows.length };
        } catch (err) {
          console.error('DB Query Error:', err.message, 'Query:', text);
          throw err;
        }
      },
      connect: async () => ({
        query: async (text, params) => {
          const rows = await sql(text, params || []);
          return { rows, rowCount: rows.length };
        },
        release: () => {},
      }),
      end: async () => {},
    };
  } else {
    // Use standard pg driver locally
    const { Pool } = require('pg');

    const poolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

    if (!global.__pgPool) {
      global.__pgPool = new Pool(poolConfig);
      global.__pgPool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
      });
    }
    pool = global.__pgPool;
  }

  return pool;
}

// Export a proxy that lazily creates the pool on first access
module.exports = new Proxy({}, {
  get(target, prop) {
    const p = getPool();
    if (typeof p[prop] === 'function') {
      return p[prop].bind(p);
    }
    return p[prop];
  },
});
