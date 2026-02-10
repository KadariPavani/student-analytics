const pool = require('../src/config/db');
const fs = require('fs');
const path = require('path');
(async () => {
  const client = await pool.connect();
  try {
    // Drop old views first (needed when column definitions change)
    await client.query(`
      DROP MATERIALIZED VIEW IF EXISTS vw_placement_overview CASCADE;
      DROP MATERIALIZED VIEW IF EXISTS vw_branch_placement_summary CASCADE;
      DROP VIEW IF EXISTS vw_fmml_impact CASCADE;
      DROP VIEW IF EXISTS vw_khub_impact CASCADE;
      DROP VIEW IF EXISTS vw_ctc_bands CASCADE;
      DROP VIEW IF EXISTS vw_company_summary CASCADE;
    `);
    console.log('Old views dropped.');

    const v = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'views.sql'), 'utf8');
    await client.query(v);
    console.log('Views created.');
    const f = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'functions.sql'), 'utf8');
    await client.query(f);
    console.log('Functions created.');
    await client.query('SELECT refresh_analytics()');
    console.log('Materialized views refreshed.');
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    await pool.end();
  }
})();