const pool = require('../src/config/db');
(async () => {
  const client = await pool.connect();
  try {
    const rows = (await client.query("SELECT company_name, COUNT(*) as cnt FROM placements WHERE UPPER(TRIM(COALESCE(company_name,''))) IN ('NA','N/A','N.A','N.A.','NONE','NIL','-','--','NA.') GROUP BY company_name ORDER BY cnt DESC")).rows;
    console.table(rows);
    const t = (await client.query("SELECT COUNT(*) FROM placements WHERE UPPER(TRIM(COALESCE(company_name,''))) IN ('NA','N/A','N.A','N.A.','NONE','NIL','-','--','NA.')")).rows[0].count;
    console.log('Total NA rows:', t);
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    await pool.end();
  }
})();