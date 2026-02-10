const pool = require('../src/config/db');
(async () => {
  const client = await pool.connect();
  try {
    const placeholders = ['NA','N/A','N.A','N.A.','NONE','NIL','-','--','NA.'];
    const res = await client.query(`DELETE FROM placements WHERE UPPER(TRIM(COALESCE(company_name, ''))) IN (${placeholders.map((_,i)=>`$${i+1}`).join(',')}) RETURNING placement_id` , placeholders);
    console.log('Deleted NA-like placements:', res.rowCount);
    await client.query('SELECT refresh_analytics()');
    console.log('Materialized views refreshed');
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    await pool.end();
  }
})();