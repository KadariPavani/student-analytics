const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/batches — list all batches (grouped by year)
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        yi.passout_year,
        json_agg(json_build_object(
          'id', yi.id,
          'college', yi.college,
          'branch', yi.branch,
          'total_students', yi.total_students
        ) ORDER BY yi.college, yi.branch) AS intake_data,
        SUM(yi.total_students) AS total_intake,
        (SELECT COUNT(DISTINCT s.roll_no) FROM students s WHERE s.passout_year = yi.passout_year) AS registered_students,
        (SELECT COUNT(DISTINCT p.roll_no) FROM placements p JOIN students s ON s.roll_no = p.roll_no WHERE s.passout_year = yi.passout_year) AS placed_students,
        (SELECT COUNT(DISTINCT f.roll_no) FROM fmml_participation f JOIN students s ON s.roll_no = f.roll_no WHERE s.passout_year = yi.passout_year) AS fmml_count,
        (SELECT COUNT(DISTINCT k.roll_no) FROM khub_participation k JOIN students s ON s.roll_no = k.roll_no WHERE s.passout_year = yi.passout_year) AS khub_count
      FROM yearly_intake yi
      GROUP BY yi.passout_year
      ORDER BY yi.passout_year DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('List batches error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/batches/years — list distinct years
router.get('/years', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT passout_year FROM yearly_intake ORDER BY passout_year DESC'
    );
    res.json(result.rows.map(r => r.passout_year));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/batches — admin creates batch intake entry
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { passout_year, entries } = req.body;
    // entries = [{ college, branch, total_students }, ...]
    if (!passout_year || !entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'passout_year and entries[] are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const added = [];
      for (const entry of entries) {
        const { college, branch, total_students } = entry;
        if (!college || !branch || !total_students) continue;
        const r = await client.query(
          `INSERT INTO yearly_intake (passout_year, college, branch, total_students)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (passout_year, college, branch) DO UPDATE SET total_students = $4
           RETURNING *`,
          [passout_year, college, branch, parseInt(total_students)]
        );
        added.push(r.rows[0]);
      }
      await client.query('COMMIT');
      res.status(201).json({ message: `${added.length} intake entries saved`, data: added });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create batch error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PUT /api/batches/:id — admin updates single intake entry
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { total_students } = req.body;
    if (!total_students || total_students <= 0) {
      return res.status(400).json({ error: 'total_students must be > 0' });
    }
    const result = await pool.query(
      'UPDATE yearly_intake SET total_students = $1 WHERE id = $2 RETURNING *',
      [parseInt(total_students), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Intake entry not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update batch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/batches/:id — admin deletes single intake entry
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM yearly_intake WHERE id = $1', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete batch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/batches/year/:year — admin deletes all data for a passout year
router.delete('/year/:year', authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const year = parseInt(req.params.year);
    await client.query('BEGIN');
    // Delete in dependency order
    await client.query('DELETE FROM khub_participation WHERE roll_no IN (SELECT roll_no FROM students WHERE passout_year = $1)', [year]);
    await client.query('DELETE FROM fmml_participation WHERE roll_no IN (SELECT roll_no FROM students WHERE passout_year = $1)', [year]);
    await client.query('DELETE FROM placements WHERE roll_no IN (SELECT roll_no FROM students WHERE passout_year = $1)', [year]);
    await client.query('DELETE FROM students WHERE passout_year = $1', [year]);
    await client.query('DELETE FROM yearly_intake WHERE passout_year = $1', [year]);
    await client.query('DELETE FROM upload_history WHERE passout_year = $1', [year]);
    await client.query('COMMIT');
    // Refresh views
    try { await pool.query('SELECT refresh_analytics()'); } catch (e) { /* ignore if no data */ }
    res.json({ message: `All data for batch ${year} deleted` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete year error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
