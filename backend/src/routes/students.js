const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/students — paginated list with search / filter
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { search, branch, passout_year, college, gender, placed, sort_by, sort_order } = req.query;

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (search) {
      where += ` AND (s.name ILIKE $${idx} OR s.roll_no ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (branch) {
      where += ` AND s.branch = $${idx}`;
      params.push(branch);
      idx++;
    }
    if (passout_year) {
      where += ` AND s.passout_year = $${idx}`;
      params.push(parseInt(passout_year));
      idx++;
    }
    if (college) {
      where += ` AND s.college = $${idx}`;
      params.push(college);
      idx++;
    }
    if (gender) {
      where += ` AND s.gender = $${idx}`;
      params.push(gender);
      idx++;
    }
    if (placed === 'true') {
      where += ' AND EXISTS (SELECT 1 FROM placements p WHERE p.roll_no = s.roll_no)';
    } else if (placed === 'false') {
      where += ' AND NOT EXISTS (SELECT 1 FROM placements p WHERE p.roll_no = s.roll_no)';
    }

    const validSort = ['name', 'roll_no', 'passout_year', 'branch', 'college'];
    const sortCol = validSort.includes(sort_by) ? `s.${sort_by}` : 's.name';
    const sortDir = sort_order === 'desc' ? 'DESC' : 'ASC';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM students s ${where}`,
      params
    );

    const result = await pool.query(`
      SELECT
        s.*,
        EXISTS (SELECT 1 FROM placements p WHERE p.roll_no = s.roll_no)  AS is_placed,
        EXISTS (SELECT 1 FROM fmml_participation f WHERE f.roll_no = s.roll_no) AS has_fmml,
        EXISTS (SELECT 1 FROM khub_participation kp WHERE kp.roll_no = s.roll_no) AS has_khub
      FROM students s
      ${where}
      ORDER BY ${sortCol} ${sortDir}
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
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/students/branches — distinct branches
router.get('/branches', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT branch FROM students ORDER BY branch'
    );
    res.json(result.rows.map(r => r.branch));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/students/:rollNo — full profile
router.get('/:rollNo', async (req, res) => {
  try {
    const { rollNo } = req.params;

    const studentResult = await pool.query(
      'SELECT * FROM students WHERE roll_no = $1', [rollNo]
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const placementsResult = await pool.query(
      'SELECT * FROM placements WHERE roll_no = $1 ORDER BY ctc_lpa DESC', [rollNo]
    );

    const fmmlResult = await pool.query(
      'SELECT * FROM fmml_participation WHERE roll_no = $1', [rollNo]
    );

    const khubResult = await pool.query(
      'SELECT * FROM khub_participation WHERE roll_no = $1', [rollNo]
    );

    res.json({
      student: studentResult.rows[0],
      placements: placementsResult.rows,
      fmml: fmmlResult.rows,
      khub: khubResult.rows,
    });
  } catch (err) {
    console.error('Error fetching student detail:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/students/export/placed — download placed students as XLSX (yearwise sheets)
router.get('/export/placed', async (req, res) => {
  try {
    const yearwise = req.query.yearwise !== 'false';
    // fetch years (descending)
    const yearsResult = await pool.query('SELECT DISTINCT passout_year FROM students ORDER BY passout_year DESC');
    const years = yearsResult.rows.map(r => r.passout_year);

    const XLSX = require('xlsx');
    const workbook = XLSX.utils.book_new();

    const makeRowsForYear = async (yr) => {
      const q = `
        SELECT
          s.roll_no, s.name, s.college, s.branch, s.passout_year, s.gender,
          p.company_name, p.role, p.ctc_lpa, p.offer_type, p.source,
          EXISTS (SELECT 1 FROM fmml_participation f WHERE f.roll_no = s.roll_no) AS has_fmml,
          EXISTS (SELECT 1 FROM khub_participation k WHERE k.roll_no = s.roll_no) AS has_khub
        FROM students s
        JOIN placements p ON p.roll_no = s.roll_no
        WHERE s.passout_year = $1
        ORDER BY p.ctc_lpa DESC NULLS LAST, s.name ASC
      `;
      const r = await pool.query(q, [yr]);
      return r.rows.map(row => ({
        'Roll No': row.roll_no,
        'Name': row.name,
        'College': row.college,
        'Branch': row.branch,
        'Year': row.passout_year,
        'Gender': row.gender,
        'Company': row.company_name,
        'Role': row.role,
        'Offer Type': row.offer_type,
        'CTC (LPA)': row.ctc_lpa,
        'Source': row.source,
        'FMML': row.has_fmml ? 'Yes' : 'No',
        'KHUB': row.has_khub ? 'Yes' : 'No',
      }));
    };

    if (yearwise) {
      for (const yr of years) {
        const rows = await makeRowsForYear(yr);
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(workbook, ws, `Year ${yr}`);
      }
    } else {
      // Combined sheet
      let allRows = [];
      for (const yr of years) {
        const rows = await makeRowsForYear(yr);
        allRows = allRows.concat(rows);
      }
      const ws = XLSX.utils.json_to_sheet(allRows);
      XLSX.utils.book_append_sheet(workbook, ws, 'Placed Students');
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=placed_students_by_year.xlsx');
    return res.send(buffer);
  } catch (err) {
    console.error('Error exporting placed students:', err);
    return res.status(500).json({ error: 'Failed to generate export' });
  }
});

module.exports = router;
