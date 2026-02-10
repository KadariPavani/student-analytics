const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/placements — paginated placement list
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { company, offer_type, passout_year, branch, source, min_ctc, max_ctc } = req.query;

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (company) {
      where += ` AND p.company_name ILIKE $${idx}`;
      params.push(`%${company}%`);
      idx++;
    }
    if (offer_type) {
      where += ` AND p.offer_type = $${idx}`;
      params.push(offer_type);
      idx++;
    }
    if (passout_year) {
      where += ` AND s.passout_year = $${idx}`;
      params.push(parseInt(passout_year));
      idx++;
    }
    if (branch) {
      where += ` AND s.branch = $${idx}`;
      params.push(branch);
      idx++;
    }
    if (source) {
      where += ` AND p.source = $${idx}`;
      params.push(source);
      idx++;
    }
    if (min_ctc) {
      where += ` AND p.ctc_lpa >= $${idx}`;
      params.push(parseFloat(min_ctc));
      idx++;
    }
    if (max_ctc) {
      where += ` AND p.ctc_lpa <= $${idx}`;
      params.push(parseFloat(max_ctc));
      idx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM placements p JOIN students s ON s.roll_no = p.roll_no ${where}`,
      params
    );

    const result = await pool.query(`
      SELECT
        p.*,
        s.name,
        s.branch,
        s.college,
        s.passout_year
      FROM placements p
      JOIN students s ON s.roll_no = p.roll_no
      ${where}
      ORDER BY p.ctc_lpa DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error('Placements list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
