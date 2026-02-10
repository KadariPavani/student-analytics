const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ── 1. GET /api/analytics/overview ──────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const { passout_year } = req.query;
    const yearFilter = passout_year ? parseInt(passout_year) : null;

    // Build year conditions for each table
    const yiCond = yearFilter ? `WHERE passout_year = ${yearFilter}` : '';
    const sCond = yearFilter ? `WHERE s.passout_year = ${yearFilter}` : '';
    const sJoinCond = yearFilter ? `AND s.passout_year = ${yearFilter}` : '';
    const pStudentCond = yearFilter
      ? `AND roll_no IN (SELECT roll_no FROM students WHERE passout_year = ${yearFilter})`
      : '';

    const result = await pool.query(`
      SELECT
        -- Total students from admin-managed intake
        (SELECT COALESCE(SUM(total_students), 0) FROM yearly_intake ${yiCond}) AS total_students,

        -- Placed students: campus placements only (On-Campus/Off-Campus/Pool)
        (SELECT COUNT(DISTINCT roll_no) FROM placements
         WHERE source IN ('On-Campus','Off-Campus','Pool') ${pStudentCond}) AS placed_students,

        -- Total placed (all sources, deduplicated by student)
        (SELECT COUNT(DISTINCT roll_no) FROM placements WHERE 1=1 ${pStudentCond}) AS total_placed_all,

        -- Placement % = campus-placed / intake
        ROUND(100.0 *
          (SELECT COUNT(DISTINCT roll_no) FROM placements WHERE source IN ('On-Campus','Off-Campus','Pool') ${pStudentCond})
          / NULLIF((SELECT COALESCE(SUM(total_students), 0) FROM yearly_intake ${yiCond}), 0)
        , 2) AS placement_pct,

        -- Total offers (all sources)
        (SELECT COUNT(*) FROM placements WHERE 1=1 ${pStudentCond}) AS total_offers,

        -- CTC stats
        (SELECT ROUND(MAX(ctc_lpa), 2) FROM placements WHERE 1=1 ${pStudentCond}) AS max_ctc,

        -- FMML: total enrolled, placed (FMML + has any placement), %
        (SELECT COUNT(DISTINCT f.roll_no) FROM fmml_participation f
         JOIN students s ON s.roll_no = f.roll_no ${sCond ? 'WHERE s.passout_year = ' + yearFilter : ''}) AS total_fmml,
        (SELECT COUNT(DISTINCT f.roll_no) FROM fmml_participation f
         JOIN placements p ON p.roll_no = f.roll_no
         JOIN students s ON s.roll_no = f.roll_no WHERE 1=1 ${sJoinCond}) AS fmml_placed,
        ROUND(100.0 *
          (SELECT COUNT(DISTINCT f.roll_no) FROM fmml_participation f
           JOIN placements p ON p.roll_no = f.roll_no
           JOIN students s ON s.roll_no = f.roll_no WHERE 1=1 ${sJoinCond})
          / NULLIF((SELECT COUNT(DISTINCT f.roll_no) FROM fmml_participation f
           JOIN students s ON s.roll_no = f.roll_no WHERE 1=1 ${sJoinCond}), 0)
        , 2) AS fmml_pct,

        -- FMML / Non-FMML CTC stats removed (average values suppressed)
        -- (fmml_avg_ctc and non_fmml_avg_ctc removed per admin request)


        -- KHUB: total members (from khub_participation) and placed members (any source)
        (SELECT COUNT(DISTINCT kp.roll_no) FROM khub_participation kp
         JOIN students s ON s.roll_no = kp.roll_no WHERE 1=1 ${sJoinCond}) AS total_khub,
        (SELECT COUNT(DISTINCT kp.roll_no) FROM khub_participation kp
         JOIN placements p ON p.roll_no = kp.roll_no
         JOIN students s ON s.roll_no = kp.roll_no WHERE 1=1 ${sJoinCond}) AS khub_placed,
        -- KHUB max CTC kept; KHUB average values removed
        (SELECT ROUND(MAX(p2.ctc_lpa), 2) FROM khub_participation kp2
         JOIN placements p2 ON p2.roll_no = kp2.roll_no
         JOIN students s2 ON s2.roll_no = kp2.roll_no WHERE 1=1 ${sJoinCond ? sJoinCond.replace('s.', 's2.') : ''}) AS khub_max_ctc,

        -- Campus avg removed (averages suppressed)
        -- (campus_avg_ctc removed per admin request) 

        -- Companies
        (SELECT COUNT(DISTINCT company_name) FROM placements WHERE 1=1 ${pStudentCond}) AS companies_visited
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Overview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 2. GET /api/analytics/placement-rate ────────────────────────
// Placement rate per batch (from materialized view or live)
router.get('/placement-rate', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        yi.passout_year,
        SUM(yi.total_students) AS total_students,
        COUNT(DISTINCT p.roll_no) AS placed_students,
        ROUND(100.0 * COUNT(DISTINCT p.roll_no) / NULLIF(SUM(yi.total_students), 0), 2) AS placement_rate_pct,
        ROUND(AVG(p.ctc_lpa), 2) AS avg_ctc,
        ROUND(MAX(p.ctc_lpa), 2) AS max_ctc,
        COUNT(DISTINCT CASE WHEN p.offer_type = 'IT' THEN p.roll_no END) AS it_placed,
        COUNT(DISTINCT CASE WHEN p.offer_type = 'Non-IT' THEN p.roll_no END) AS non_it_placed
      FROM yearly_intake yi
      LEFT JOIN students s  ON s.passout_year = yi.passout_year AND s.college = yi.college AND s.branch = yi.branch
      LEFT JOIN placements p ON p.roll_no = s.roll_no
      GROUP BY yi.passout_year
      ORDER BY yi.passout_year
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Placement rate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 3. GET /api/analytics/fmml-impact ───────────────────────────
// Only includes FMML students who are also placed
router.get('/fmml-impact', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH fmml_placed AS (
        SELECT DISTINCT f.roll_no
        FROM fmml_participation f
        JOIN placements p ON p.roll_no = f.roll_no
      )
      SELECT
        CASE WHEN fp.roll_no IS NOT NULL THEN 'FMML' ELSE 'Non-FMML' END AS group_label,
        COUNT(DISTINCT p.roll_no) AS placed_students,
        ROUND(MAX(p.ctc_lpa), 2) AS max_ctc,
        ROUND(MIN(p.ctc_lpa), 2) AS min_ctc,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.ctc_lpa)::NUMERIC, 2) AS median_ctc,
        COUNT(DISTINCT CASE WHEN p.offer_type = 'IT' THEN p.roll_no END) AS it_offers,
        COUNT(DISTINCT CASE WHEN p.offer_type = 'Non-IT' THEN p.roll_no END) AS non_it_offers
      FROM placements p
      LEFT JOIN fmml_placed fp ON fp.roll_no = p.roll_no
      GROUP BY CASE WHEN fp.roll_no IS NOT NULL THEN 'FMML' ELSE 'Non-FMML' END
      ORDER BY group_label
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('FMML impact error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 4. GET /api/analytics/khub-impact ───────────────────────────
// Compare KHUB members vs non-members placements
router.get('/khub-impact', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH khub_placed AS (
        SELECT DISTINCT kp.roll_no
        FROM khub_participation kp
        JOIN placements p ON p.roll_no = kp.roll_no
      )
      SELECT
        CASE WHEN kp.roll_no IS NOT NULL THEN 'KHUB' ELSE 'Non-KHUB' END AS group_label,
        COUNT(DISTINCT p.roll_no) AS placed_students,
        ROUND(MAX(p.ctc_lpa), 2) AS max_ctc,
        ROUND(MIN(p.ctc_lpa), 2) AS min_ctc,
        COUNT(DISTINCT CASE WHEN p.offer_type = 'IT' THEN p.roll_no END) AS it_offers,
        COUNT(DISTINCT CASE WHEN p.offer_type = 'Non-IT' THEN p.roll_no END) AS non_it_offers
      FROM placements p
      LEFT JOIN khub_placed kp ON kp.roll_no = p.roll_no
      GROUP BY CASE WHEN kp.roll_no IS NOT NULL THEN 'KHUB' ELSE 'Non-KHUB' END
      ORDER BY group_label
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('KHUB impact error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 5. GET /api/analytics/it-vs-nonit ───────────────────────────
router.get('/it-vs-nonit', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        offer_type,
        COUNT(*) AS offer_count,
        COUNT(DISTINCT roll_no) AS student_count,
        ROUND(MIN(ctc_lpa), 2) AS min_ctc,
        ROUND(MAX(ctc_lpa), 2) AS max_ctc,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ctc_lpa)::NUMERIC, 2) AS median_ctc
      FROM placements
      GROUP BY offer_type
      ORDER BY max_ctc DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('IT vs Non-IT error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 6. GET /api/analytics/ctc-bands ─────────────────────────────
router.get('/ctc-bands', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        CASE
          WHEN ctc_lpa >= 20 THEN '20+ LPA'
          WHEN ctc_lpa >= 12 THEN '12-20 LPA'
          WHEN ctc_lpa >= 8  THEN '8-12 LPA'
          WHEN ctc_lpa >= 5  THEN '5-8 LPA'
          WHEN ctc_lpa >= 3  THEN '3-5 LPA'
          ELSE 'Below 3 LPA'
        END AS salary_band,
        COUNT(*) AS offer_count,
        COUNT(DISTINCT roll_no) AS student_count,
        CASE
          WHEN ctc_lpa >= 20 THEN 6
          WHEN ctc_lpa >= 12 THEN 5
          WHEN ctc_lpa >= 8  THEN 4
          WHEN ctc_lpa >= 5  THEN 3
          WHEN ctc_lpa >= 3  THEN 2
          ELSE 1
        END AS band_order
      FROM placements
      GROUP BY salary_band, band_order
      ORDER BY band_order DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('CTC bands error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 7. GET /api/analytics/branch-wise ───────────────────────────
router.get('/branch-wise', async (req, res) => {
  try {
    const { passout_year } = req.query;
    const yearCond = passout_year ? 'WHERE yi.passout_year = $1' : '';
    const placedCond = passout_year ? 'WHERE s.passout_year = $1' : '';
    const params = passout_year ? [parseInt(passout_year)] : [];

    const result = await pool.query(`
      WITH intake AS (
        SELECT branch, SUM(total_students) AS total_students
        FROM yearly_intake yi ${yearCond}
        GROUP BY branch
      ),
      placed AS (
        SELECT s.branch,
          COUNT(DISTINCT p.roll_no) AS placed_students,
          COUNT(DISTINCT CASE WHEN p.source IN ('On-Campus','Off-Campus','Pool') THEN p.roll_no END) AS campus_placed,
          ROUND(MAX(p.ctc_lpa), 2) AS max_ctc
        FROM students s
        JOIN placements p ON p.roll_no = s.roll_no
        ${placedCond}
        GROUP BY s.branch
      ),
      fmml AS (
        SELECT s.branch,
          COUNT(DISTINCT f.roll_no) AS fmml_registered,
          COUNT(DISTINCT CASE WHEN p.roll_no IS NOT NULL THEN f.roll_no END) AS fmml_placed
        FROM fmml_participation f
        JOIN students s ON s.roll_no = f.roll_no
        LEFT JOIN placements p ON p.roll_no = f.roll_no
        ${placedCond}
        GROUP BY s.branch
      ),
      khub AS (
        SELECT s.branch,
          COUNT(DISTINCT kp.roll_no) AS khub_registered,
          COUNT(DISTINCT CASE WHEN p.roll_no IS NOT NULL THEN kp.roll_no END) AS khub_placed
        FROM khub_participation kp
        JOIN students s ON s.roll_no = kp.roll_no
        LEFT JOIN placements p ON p.roll_no = kp.roll_no
        ${placedCond}
        GROUP BY s.branch
      )
      SELECT
        i.branch,
        i.total_students,
        COALESCE(pl.campus_placed, 0) AS placed_students,
        ROUND(100.0 * COALESCE(pl.campus_placed, 0) / NULLIF(i.total_students, 0), 2) AS placement_rate,
        COALESCE(fm.fmml_placed, 0) AS fmml_placed,
        COALESCE(kh.khub_placed, 0) AS khub_students,
        pl.max_ctc
      FROM intake i
      LEFT JOIN placed pl ON pl.branch = i.branch
      LEFT JOIN fmml fm ON fm.branch = i.branch
      LEFT JOIN khub kh ON kh.branch = i.branch
      ORDER BY placement_rate DESC NULLS LAST
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Branch-wise error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 8. GET /api/analytics/company-wise ──────────────────────────
router.get('/company-wise', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const result = await pool.query(`
      SELECT
        p.company_name,
        p.offer_type,
        COUNT(*) AS total_offers,
        COUNT(DISTINCT p.roll_no) AS unique_students,
        ROUND(MAX(p.ctc_lpa), 2) AS max_ctc,
        COUNT(DISTINCT CASE WHEN f.roll_no IS NOT NULL THEN p.roll_no END) AS fmml_students,
        COUNT(DISTINCT CASE WHEN k.roll_no IS NOT NULL THEN p.roll_no END) AS khub_students
      FROM placements p
      LEFT JOIN fmml_participation f ON f.roll_no = p.roll_no
      LEFT JOIN khub_participation k ON k.roll_no = p.roll_no
      GROUP BY p.company_name, p.offer_type
      ORDER BY total_offers DESC
      LIMIT $1
    `, [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error('Company-wise error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 9. GET /api/analytics/top-packages ──────────────────────────
router.get('/top-packages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const result = await pool.query(`
      SELECT
        p.placement_id,
        p.roll_no,
        s.name,
        s.branch,
        s.college,
        s.passout_year,
        p.company_name,
        p.ctc_lpa,
        p.offer_type,
        p.role,
        p.source,
        CASE WHEN f.roll_no IS NOT NULL THEN true ELSE false END AS has_fmml,
        CASE WHEN k.roll_no IS NOT NULL THEN true ELSE false END AS has_khub
      FROM placements p
      JOIN students s ON s.roll_no = p.roll_no
      LEFT JOIN fmml_participation f ON f.roll_no = p.roll_no
      LEFT JOIN khub_participation k ON k.roll_no = p.roll_no
      WHERE UPPER(TRIM(COALESCE(p.company_name, ''))) NOT IN ('NA','N/A','N.A','N.A.','NONE','NIL','-','--','NA.')
      ORDER BY p.ctc_lpa DESC
      LIMIT $1
    `, [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error('Top packages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 10. GET /api/analytics/college-wise ─────────────────────────
router.get('/college-wise', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH intake AS (
        SELECT college, SUM(total_students) AS total_students
        FROM yearly_intake
        GROUP BY college
      ),
      placed AS (
        SELECT s.college,
          COUNT(DISTINCT p.roll_no) AS placed_students,
          COUNT(DISTINCT CASE WHEN p.source IN ('On-Campus','Off-Campus','Pool') THEN p.roll_no END) AS campus_placed,
          ROUND(MAX(p.ctc_lpa), 2) AS max_ctc
        FROM students s
        JOIN placements p ON p.roll_no = s.roll_no
        GROUP BY s.college
      ),
      fmml AS (
        SELECT s.college,
          COUNT(DISTINCT f.roll_no) AS fmml_registered,
          COUNT(DISTINCT CASE WHEN p.roll_no IS NOT NULL THEN f.roll_no END) AS fmml_placed
        FROM fmml_participation f
        JOIN students s ON s.roll_no = f.roll_no
        LEFT JOIN placements p ON p.roll_no = f.roll_no
        GROUP BY s.college
      ),
      khub AS (
        SELECT s.college,
          COUNT(DISTINCT kp.roll_no) AS khub_registered,
          COUNT(DISTINCT CASE WHEN p.roll_no IS NOT NULL THEN kp.roll_no END) AS khub_placed
        FROM khub_participation kp
        JOIN students s ON s.roll_no = kp.roll_no
        LEFT JOIN placements p ON p.roll_no = kp.roll_no
        GROUP BY s.college
      )
      SELECT
        i.college,
        i.total_students,
        COALESCE(pl.campus_placed, 0) AS placed_students,
        ROUND(100.0 * COALESCE(pl.campus_placed, 0) / NULLIF(i.total_students, 0), 2) AS placement_rate,
        COALESCE(fm.fmml_placed, 0) AS fmml_placed,
        COALESCE(kh.khub_placed, 0) AS khub_students,
        pl.max_ctc
      FROM intake i
      LEFT JOIN placed pl ON pl.college = i.college
      LEFT JOIN fmml fm ON fm.college = i.college
      LEFT JOIN khub kh ON kh.college = i.college
      ORDER BY placement_rate DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('College-wise error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 11. GET /api/analytics/fmml-detail ──────────────────────────
router.get('/fmml-detail', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        f.fmml_batch,
        f.status,
        COUNT(*) AS participants,
        COUNT(DISTINCT p.roll_no) AS placed,
        ROUND(AVG(f.score), 2)   AS avg_score
      FROM fmml_participation f
      LEFT JOIN placements p ON p.roll_no = f.roll_no
      GROUP BY f.fmml_batch, f.status
      ORDER BY f.fmml_batch, f.status
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('FMML detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 12. GET /api/analytics/year-wise-summary ────────────────────
// Year-wise breakdown of Campus, FMML, and KHUB placements
router.get('/year-wise-summary', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH year_intake AS (
        SELECT passout_year, SUM(total_students) AS total_students
        FROM yearly_intake
        GROUP BY passout_year
      ),
      campus_placements AS (
        SELECT s.passout_year,
          COUNT(DISTINCT p.roll_no) AS campus_placed,
          ROUND(MAX(p.ctc_lpa), 2) AS campus_max_ctc
        FROM placements p
        JOIN students s ON s.roll_no = p.roll_no
        WHERE p.source IN ('On-Campus','Off-Campus','Pool')
        GROUP BY s.passout_year
      ),
      fmml_stats AS (
        SELECT s.passout_year,
          COUNT(DISTINCT f.roll_no) AS fmml_registered,
          COUNT(DISTINCT CASE WHEN p.roll_no IS NOT NULL THEN f.roll_no END) AS fmml_placed
        FROM fmml_participation f
        JOIN students s ON s.roll_no = f.roll_no
        LEFT JOIN placements p ON p.roll_no = f.roll_no
        GROUP BY s.passout_year
      ),
      khub_stats AS (
        SELECT s.passout_year,
          COUNT(DISTINCT kp.roll_no) AS khub_registered,
          COUNT(DISTINCT CASE WHEN p.roll_no IS NOT NULL THEN kp.roll_no END) AS khub_placed
        FROM khub_participation kp
        JOIN students s ON s.roll_no = kp.roll_no
        LEFT JOIN placements p ON p.roll_no = kp.roll_no
        GROUP BY s.passout_year
      ),
      total_placed AS (
        SELECT s.passout_year,
          COUNT(DISTINCT p.roll_no) AS total_placed
        FROM placements p
        JOIN students s ON s.roll_no = p.roll_no
        GROUP BY s.passout_year
      )
      SELECT
        yi.passout_year,
        yi.total_students,
        COALESCE(cp.campus_placed, 0) AS campus_placed,
        ROUND(100.0 * COALESCE(cp.campus_placed, 0) / NULLIF(yi.total_students, 0), 2) AS campus_pct,
        COALESCE(fm.fmml_registered, 0) AS fmml_registered,
        COALESCE(fm.fmml_placed, 0) AS fmml_placed,
        ROUND(100.0 * COALESCE(fm.fmml_placed, 0) / NULLIF(fm.fmml_registered, 0), 2) AS fmml_pct,
        COALESCE(kh.khub_registered, 0) AS khub_registered,
        COALESCE(kh.khub_placed, 0) AS khub_placed,
        ROUND(100.0 * COALESCE(kh.khub_placed, 0) / NULLIF(kh.khub_registered, 0), 2) AS khub_pct,
        COALESCE(tp.total_placed, 0) AS total_placed,
        ROUND(100.0 * COALESCE(tp.total_placed, 0) / NULLIF(yi.total_students, 0), 2) AS total_pct
      FROM year_intake yi
      LEFT JOIN campus_placements cp ON cp.passout_year = yi.passout_year
      LEFT JOIN fmml_stats fm ON fm.passout_year = yi.passout_year
      LEFT JOIN khub_stats kh ON kh.passout_year = yi.passout_year
      LEFT JOIN total_placed tp ON tp.passout_year = yi.passout_year
      ORDER BY yi.passout_year
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Year-wise summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 13. GET /api/analytics/refresh ──────────────────────────────
router.get('/refresh', async (req, res) => {
  try {
    await pool.query('SELECT refresh_analytics()');
    res.json({ message: 'Materialized views refreshed' });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
