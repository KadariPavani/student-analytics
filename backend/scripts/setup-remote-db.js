const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sqlDir = path.join(__dirname, '..', 'src', 'db');

async function run() {
  const client = await pool.connect();
  console.log('Connected to Neon!\n');

  console.log('1/4  Applying schema...');
  await client.query(fs.readFileSync(path.join(sqlDir, 'schema.sql'), 'utf8'));
  console.log('     Done.\n');

  console.log('2/4  Applying views...');
  await client.query(fs.readFileSync(path.join(sqlDir, 'views.sql'), 'utf8'));
  console.log('     Done.\n');

  console.log('3/4  Applying functions...');
  await client.query(fs.readFileSync(path.join(sqlDir, 'functions.sql'), 'utf8'));
  console.log('     Done.\n');

  console.log('4/4  Creating default admin user...');
  const hash = await bcrypt.hash('admin123', 10);
  await client.query(
    "INSERT INTO users (username, password_hash, role, full_name) VALUES ('admin', $1, 'admin', 'System Administrator') ON CONFLICT (username) DO NOTHING",
    [hash]
  );
  console.log('     Done.  (username: admin  /  password: admin123)\n');

  client.release();
  await pool.end();
  console.log('Remote database is ready!');
}

run().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
