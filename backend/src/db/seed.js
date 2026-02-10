/**
 * Database initialization & default admin creation.
 * Run: node src/db/seed.js
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function run() {
  const client = await pool.connect();
  try {
    console.log('Applying schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema applied.');

    console.log('Applying views...');
    const views = fs.readFileSync(path.join(__dirname, 'views.sql'), 'utf8');
    await client.query(views);
    console.log('Views applied.');

    console.log('Applying functions...');
    const funcs = fs.readFileSync(path.join(__dirname, 'functions.sql'), 'utf8');
    await client.query(funcs);
    console.log('Functions applied.');

    // Create default admin user (admin / admin123)
    const hash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (username, password_hash, role, full_name)
       VALUES ('admin', $1, 'admin', 'System Administrator')
       ON CONFLICT (username) DO NOTHING`,
      [hash]
    );
    console.log('Default admin created (username: admin, password: admin123)');

    console.log('\nDatabase initialized successfully. No dummy data inserted.');
    console.log('Upload real data via the admin panel.');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
