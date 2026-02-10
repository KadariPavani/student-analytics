const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    cb(null, `${ts}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// ── Helper: normalise sheet rows (trim & lowercase column names) ──
function normalizeRows(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return data
    .map(row => {
      const clean = {};
      for (const [key, val] of Object.entries(row)) {
        const normKey = key.trim().toLowerCase().replace(/\s+/g, '_');
        // Strip blank/empty columns that xlsx generates (e.g. __empty, __empty_1 …)
        if (/^__empty/.test(normKey)) continue;
        clean[normKey] = typeof val === 'string' ? val.trim() : val;
      }
      return aliasColumns(clean);
    })
    // Drop completely empty rows (all values blank)
    .filter(row => Object.values(row).some(v => v !== '' && v != null));
}

// ── Helper: map common column name variants ──────────────────
function aliasColumns(row) {
  const mapped = {};
  for (const [k, v] of Object.entries(row)) {
    // Skip serial-number columns
    if (/^s\.?n?o$|^sno$|^sl_?no$/.test(k)) continue;
    // Map "IT/NON IT" style columns → offer_type
    if (/it.*non/i.test(k) || k === 'it/non_it' || k === 'it/non-it') {
      mapped.offer_type = v;
      continue;
    }
    mapped[k] = v;
  }
  // Simple aliases (only if target key not already present)
  if (!mapped.student_name && mapped.name)         { mapped.student_name = mapped.name;    delete mapped.name; }
  if (!mapped.roll_no     && mapped.rollno)         { mapped.roll_no = mapped.rollno;       delete mapped.rollno; }
  if (!mapped.roll_no     && mapped['roll_number']) { mapped.roll_no = mapped['roll_number']; delete mapped['roll_number']; }
  if (!mapped.company_name && mapped.company)       { mapped.company_name = mapped.company;  delete mapped.company; }
  if (!mapped.ctc_lpa     && mapped.package)        { mapped.ctc_lpa = mapped.package;       delete mapped.package; }
  if (!mapped.ctc_lpa     && mapped.ctc)            { mapped.ctc_lpa = mapped.ctc;           delete mapped.ctc; }
  return mapped;
}

// ── Helper: find sheet by loose name match ───────────────────
function findSheet(workbook, ...patterns) {
  for (const name of workbook.SheetNames) {
    const lower = name.toLowerCase().replace(/\s+/g, '');
    for (const p of patterns) {
      if (lower.includes(p)) return workbook.Sheets[name];
    }
  }
  return null;
}

// ── Helper: map gender values ────────────────────────────────
function normalizeGender(val) {
  if (!val) return null;
  const v = String(val).trim().toUpperCase();
  if (v === 'M' || v === 'MALE') return 'Male';
  if (v === 'F' || v === 'FEMALE') return 'Female';
  return 'Other';
}

// ── Helper: map offer type values ────────────────────────────
function normalizeOfferType(val) {
  if (!val) return 'NA';
  const v = String(val).trim().toUpperCase();
  if (v === 'IT') return 'IT';
  if (v === 'NON-IT' || v === 'NONIT' || v === 'NON IT') return 'Non-IT';
  if (v === 'CORE') return 'Core';
  return 'NA';
}

// ── Helper: map source values ────────────────────────────────
function normalizeSource(val) {
  if (!val) return 'On-Campus';
  const v = String(val).trim().toUpperCase();
  if (v.includes('OFF')) return 'Off-Campus';
  if (v.includes('POOL')) return 'Pool';
  return 'On-Campus';
}

// ── Helper: map status values ────────────────────────────────
function normalizeFmmlStatus(val) {
  if (!val) return 'Enrolled';
  const v = String(val).trim().toUpperCase();
  if (v.includes('COMP')) return 'Completed';
  if (v.includes('DROP')) return 'Dropped';
  return 'Enrolled';
}

function normalizeKhubStatus(val) {
  if (!val) return 'Active';
  const v = String(val).trim().toUpperCase();
  if (v.includes('COMP')) return 'Completed';
  if (v.includes('INACT')) return 'Inactive';
  return 'Active';
}

// ── Helper: parse CTC (handles monthly vs yearly) ────────────
// Examples:
//   "10k" or "10K" → 10,000 monthly → 1.2 LPA
//   "15000" → 15,000 monthly → 1.8 LPA
//   "3.6" or "4" → already in LPA
//   "360000" → 3.6 LPA (interpreting as yearly)
function parseCtcToLPA(val) {
  if (!val) return 0;
  
  let str = String(val).trim().toUpperCase();
  
  // Remove common currency symbols and spaces
  str = str.replace(/₹|RS\.?|INR/gi, '').trim();
  
  // Handle "k" or "K" suffix (e.g., "10k" = 10,000 monthly)
  if (str.endsWith('K')) {
    const num = parseFloat(str.slice(0, -1));
    if (isNaN(num)) return 0;
    // Convert to LPA: (num * 1000 * 12) / 100000 = num * 0.12
    return parseFloat((num * 0.12).toFixed(2));
  }
  
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  
  // If value is >= 1000, assume it's monthly salary
  // Convert to LPA: (monthly * 12) / 100000
  if (num >= 1000) {
    return parseFloat(((num * 12) / 100000).toFixed(2));
  }
  
  // If value is < 100, assume it's already in LPA
  if (num < 100) {
    return parseFloat(num.toFixed(2));
  }
  
  // If value is 100-999, unclear, but treat as monthly (in thousands)
  // e.g., 100 = 100,000 monthly = 12 LPA
  return parseFloat(((num * 1000 * 12) / 100000).toFixed(2));
}

// ── Helper: derive college & branch from roll number ────────
// Format: YYccXXbbNN  e.g. 22JN1A0501
//   cc (index 2-3) → college     bb (index 6-8) → branch
const COLLEGE_CODES = { 'JN': 'KIEW', 'B2': 'KIET', '6Q': 'KIEK' };
const BRANCH_CODES  = {
  '02': 'EEE', '03': 'MECH', '04': 'ECE', '05': 'CSE',
  '42': 'CSM', '43': 'CAI', '44': 'CSD', '45': 'AID', '46': 'CSC',
  '01': 'CIVIL',
};
function parseRollNumber(rollNo) {
  const r = String(rollNo).trim().toUpperCase();
  if (r.length < 8) return { college: null, branch: null };
  const collegeCode = r.substring(2, 4);
  const branchCode  = r.substring(6, 8);
  return {
    college: COLLEGE_CODES[collegeCode] || null,
    branch:  BRANCH_CODES[branchCode]  || null,
  };
}

// Helper: treat common placeholders as non-company values
function isPlaceholderCompany(name) {
  if (!name) return true;
  const s = String(name).trim().toUpperCase();
  const placeholders = new Set(['', 'NA', 'N/A', 'N.A', 'N.A.', 'NONE', 'NIL', '-', '--', 'NA.']);
  return placeholders.has(s);
}

// ══════════════════════════════════════════════════════════════
// Internal processors (shared by single & combined endpoints)
// ══════════════════════════════════════════════════════════════
async function processPlacementRows(client, rows, passout_year) {
  let added = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const rollNo = row.roll_no ? String(row.roll_no).trim() : '';
      if (!rollNo) { skipped++; continue; }

      // Skip rows where company name is a placeholder (NA/N/A/None etc.) — not a real placement
      const companyName = row.company_name ? String(row.company_name).trim() : '';
      if (isPlaceholderCompany(companyName)) {
        skipped++;
        errors.push(`Placements Row ${i + 2}: Skipped — invalid/non-company company_name: "${row.company_name}"`);
        continue;
      }

      // Use SAVEPOINT so a single row failure doesn't abort the whole transaction
      await client.query(`SAVEPOINT placement_row_${i}`);
      const { college: derivedCollege, branch: derivedBranch } = parseRollNumber(rollNo);

      await client.query(`
        INSERT INTO students (roll_no, name, college, branch, passout_year, gender, tenth_pct, twelfth_pct, grad_cgpa, phone, email)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (roll_no) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, students.name),
          college = COALESCE(EXCLUDED.college, students.college),
          branch = COALESCE(EXCLUDED.branch, students.branch),
          gender = COALESCE(EXCLUDED.gender, students.gender),
          tenth_pct = COALESCE(EXCLUDED.tenth_pct, students.tenth_pct),
          twelfth_pct = COALESCE(EXCLUDED.twelfth_pct, students.twelfth_pct),
          grad_cgpa = COALESCE(EXCLUDED.grad_cgpa, students.grad_cgpa),
          phone = COALESCE(EXCLUDED.phone, students.phone),
          email = COALESCE(EXCLUDED.email, students.email)
      `, [
        rollNo,
        row.student_name || row.name || 'Unknown',
        String(row.college || derivedCollege || 'KIET').toUpperCase(),
        row.branch || derivedBranch || 'CSE',
        parseInt(passout_year),
        normalizeGender(row.gender),
        row.tenth_pct ? parseFloat(row.tenth_pct) : null,
        row.twelfth_pct ? parseFloat(row.twelfth_pct) : null,
        row.grad_cgpa ? parseFloat(row.grad_cgpa) : null,
        row.phone ? String(row.phone) : null,
        row.email ? String(row.email) : null,
      ]);

      const offerDate = row.offer_date ? new Date(row.offer_date) : null;
      await client.query(`
        INSERT INTO placements (roll_no, company_name, ctc_lpa, offer_type, role, source, offer_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (roll_no, LOWER(company_name)) DO UPDATE SET
          ctc_lpa    = GREATEST(placements.ctc_lpa, EXCLUDED.ctc_lpa),
          offer_type = COALESCE(EXCLUDED.offer_type, placements.offer_type),
          role       = COALESCE(EXCLUDED.role, placements.role),
          source     = COALESCE(EXCLUDED.source, placements.source),
          offer_date = COALESCE(EXCLUDED.offer_date, placements.offer_date)
      `, [
        rollNo,
        companyName,
        parseCtcToLPA(row.ctc_lpa),
        normalizeOfferType(row.offer_type),
        row.role || null,
        normalizeSource(row.source),
        offerDate && !isNaN(offerDate.getTime()) ? offerDate : null,
      ]);

      await client.query(`RELEASE SAVEPOINT placement_row_${i}`);
      added++;
    } catch (rowErr) {
      await client.query(`ROLLBACK TO SAVEPOINT placement_row_${i}`).catch(() => {});
      skipped++;
      errors.push(`Placements Row ${i + 2}: ${rowErr.message}`);
    }
  }
  return { added, skipped, errors };
}

async function processFmmlRows(client, rows, passout_year) {
  let added = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const rollNo = row.roll_no ? String(row.roll_no).trim() : '';
      if (!rollNo) { skipped++; continue; }

      // Use SAVEPOINT so a single row failure doesn't abort the whole transaction
      await client.query(`SAVEPOINT fmml_row_${i}`);
      const { college: derivedCollege, branch: derivedBranch } = parseRollNumber(rollNo);

      await client.query(`
        INSERT INTO students (roll_no, name, college, branch, passout_year, gender)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (roll_no) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, students.name),
          college = COALESCE(EXCLUDED.college, students.college),
          branch = COALESCE(EXCLUDED.branch, students.branch),
          gender = COALESCE(EXCLUDED.gender, students.gender)
      `, [
        rollNo,
        row.student_name || row.name || 'Unknown',
        String(row.college || derivedCollege || 'KIET').toUpperCase(),
        row.branch || derivedBranch || 'CSE',
        parseInt(passout_year),
        normalizeGender(row.gender),
      ]);

      const compDate = row.completion_date ? new Date(row.completion_date) : null;
      await client.query(`
        INSERT INTO fmml_participation (roll_no, fmml_batch, status, module_name, score, certificate_id, completion_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (roll_no, fmml_batch) DO UPDATE SET
          status = EXCLUDED.status,
          module_name = COALESCE(EXCLUDED.module_name, fmml_participation.module_name),
          score = COALESCE(EXCLUDED.score, fmml_participation.score),
          certificate_id = COALESCE(EXCLUDED.certificate_id, fmml_participation.certificate_id),
          completion_date = COALESCE(EXCLUDED.completion_date, fmml_participation.completion_date)
      `, [
        rollNo,
        row.fmml_batch || `FMML-${passout_year}`,
        normalizeFmmlStatus(row.status),
        row.module_name || null,
        row.score ? parseFloat(row.score) : null,
        row.certificate_id || null,
        compDate && !isNaN(compDate.getTime()) ? compDate : null,
      ]);

      await client.query(`RELEASE SAVEPOINT fmml_row_${i}`);
      added++;
    } catch (rowErr) {
      await client.query(`ROLLBACK TO SAVEPOINT fmml_row_${i}`).catch(() => {});
      skipped++;
      errors.push(`FMML Row ${i + 2}: ${rowErr.message}`);
    }
  }
  return { added, skipped, errors };
}

async function processKhubRows(client, rows, passout_year) {
  let added = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // roll_no is optional for KHUB — skip row if missing (don't fail)
      const rollNo = row.roll_no ? String(row.roll_no).trim() : '';
      if (!rollNo) {
        skipped++;
        errors.push(`KHUB Row ${i + 2}: Skipped — no roll_no`);
        continue;
      }
      const { college: derivedCollege, branch: derivedBranch } = parseRollNumber(rollNo);

      // Use SAVEPOINT so a single row failure doesn't abort the whole transaction
      await client.query(`SAVEPOINT khub_row_${i}`);

      // Upsert student
      await client.query(`
        INSERT INTO students (roll_no, name, college, branch, passout_year, gender)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (roll_no) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, students.name),
          college = COALESCE(EXCLUDED.college, students.college),
          branch = COALESCE(EXCLUDED.branch, students.branch),
          gender = COALESCE(EXCLUDED.gender, students.gender)
      `, [
        rollNo,
        row.student_name || row.name || 'Unknown',
        String(row.college || derivedCollege || 'KIET').toUpperCase(),
        row.branch || derivedBranch || 'CSE',
        parseInt(passout_year),
        normalizeGender(row.gender),
      ]);

      // Track KHUB membership in khub_participation (like fmml_participation)
      await client.query(`
        INSERT INTO khub_participation (roll_no, activity_type, status)
        VALUES ($1, 'Placement', $2)
        ON CONFLICT (roll_no, activity_type) DO NOTHING
      `, [rollNo, normalizeKhubStatus(row.status)]);

      // Insert placement record with source='KHUB'
      // Priority: On-Campus > KHUB. If same student+company already exists as On-Campus, keep On-Campus.
      const companyName = row.company_name ? String(row.company_name).trim() : '';
      if (isPlaceholderCompany(companyName)) {
        // Still count as KHUB member (inserted above), just skip the placement record
        await client.query(`RELEASE SAVEPOINT khub_row_${i}`);
        added++;
        continue;
      }
      const offerDate = row.offer_date ? new Date(row.offer_date) : null;
      await client.query(`
        INSERT INTO placements (roll_no, company_name, ctc_lpa, offer_type, role, source, offer_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (roll_no, LOWER(company_name)) DO UPDATE SET
          ctc_lpa    = GREATEST(placements.ctc_lpa, EXCLUDED.ctc_lpa),
          offer_type = COALESCE(EXCLUDED.offer_type, placements.offer_type),
          role       = COALESCE(EXCLUDED.role, placements.role),
          source     = CASE WHEN placements.source IN ('On-Campus','Off-Campus','Pool') THEN placements.source ELSE EXCLUDED.source END,
          offer_date = COALESCE(EXCLUDED.offer_date, placements.offer_date)
      `, [
        rollNo,
        companyName,
        parseCtcToLPA(row.ctc_lpa),
        normalizeOfferType(row.offer_type),
        row.role || null,
        'KHUB',
        offerDate && !isNaN(offerDate.getTime()) ? offerDate : null,
      ]);

      await client.query(`RELEASE SAVEPOINT khub_row_${i}`);
      added++;
    } catch (rowErr) {
      await client.query(`ROLLBACK TO SAVEPOINT khub_row_${i}`).catch(() => {});
      skipped++;
      errors.push(`KHUB Row ${i + 2}: ${rowErr.message}`);
    }
  }
  return { added, skipped, errors };
}

// ══════════════════════════════════════════════════════════════
// POST /api/upload/combined — Upload ONE Excel with 3 sheets
//   Sheet 1: Placements   Sheet 2: FMML   Sheet 3: KHUB
// ══════════════════════════════════════════════════════════════
router.post('/combined', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { passout_year } = req.body;
    if (!passout_year) return res.status(400).json({ error: 'passout_year is required' });
    if (!req.file) return res.status(400).json({ error: 'Excel file is required' });

    const workbook = XLSX.readFile(req.file.path);

    // Find sheets by loose name matching
    const placementSheet = findSheet(workbook, 'placement', 'placed');
    const fmmlSheet      = findSheet(workbook, 'fmml');
    const khubSheet      = findSheet(workbook, 'khub');

    // Fallback: use sheets by position if names don't match
    const sheets = workbook.SheetNames;
    const s1 = placementSheet || (sheets.length >= 1 ? workbook.Sheets[sheets[0]] : null);
    const s2 = fmmlSheet      || (sheets.length >= 2 ? workbook.Sheets[sheets[1]] : null);
    const s3 = khubSheet      || (sheets.length >= 3 ? workbook.Sheets[sheets[2]] : null);

    if (!s1) return res.status(400).json({ error: 'Could not find Placements sheet. Make sure the Excel has at least 1 sheet.' });

    const placementRows = s1 ? normalizeRows(s1) : [];
    const fmmlRows      = s2 ? normalizeRows(s2) : [];
    const khubRows      = s3 ? normalizeRows(s3) : [];

    // Validate placements required columns (branch & college auto-derived from roll number)
    if (placementRows.length > 0) {
      const required = ['roll_no', 'student_name', 'company_name', 'ctc_lpa'];
      const missing = required.filter(col => !(col in placementRows[0]));
      if (missing.length > 0) {
        console.error('Placements validation failed. Missing:', missing, 'Present:', Object.keys(placementRows[0]));
        client.release();
        return res.status(400).json({
          error: `Placements sheet: Missing required columns: ${missing.join(', ')}`,
          present_keys: Object.keys(placementRows[0]),
          hint: 'Accepted aliases: NAME→student_name, COMPANY→company_name, PACKAGE→ctc_lpa, ROLL NO→roll_no',
          expected: required,
        });
      }
    }

    // Validate FMML required columns
    if (fmmlRows.length > 0) {
      const required = ['roll_no', 'student_name'];
      const missing = required.filter(col => !(col in fmmlRows[0]));
      if (missing.length > 0) {
        console.error('FMML validation failed. Missing:', missing, 'Present:', Object.keys(fmmlRows[0]));
        client.release();
        return res.status(400).json({
          error: `FMML sheet: Missing required columns: ${missing.join(', ')}`,
          present_keys: Object.keys(fmmlRows[0]),
          hint: 'Accepted aliases: NAME→student_name, ROLL NO→roll_no',
          expected: required,
        });
      }
    }

    // KHUB: only company_name and ctc_lpa are required columns
    // roll_no is optional — rows without roll_no are skipped gracefully in processKhubRows
    if (khubRows.length > 0) {
      const required = ['student_name', 'company_name', 'ctc_lpa'];
      const missing = required.filter(col => !(col in khubRows[0]));
      if (missing.length > 0) {
        console.error('KHUB validation failed. Missing:', missing, 'Present:', Object.keys(khubRows[0]));
        client.release();
        return res.status(400).json({
          error: `KHUB sheet: Missing required columns: ${missing.join(', ')}`,
          present_keys: Object.keys(khubRows[0]),
          hint: 'Accepted aliases: NAME→student_name, COMPANY→company_name, PACKAGE→ctc_lpa, ROLL NO→roll_no. roll_no is optional — rows without it will be skipped.',
          expected: required,
        });
      }
    }

    await client.query('BEGIN');

    const pResult = placementRows.length > 0
      ? await processPlacementRows(client, placementRows, passout_year)
      : { added: 0, skipped: 0, errors: [] };

    const fResult = fmmlRows.length > 0
      ? await processFmmlRows(client, fmmlRows, passout_year)
      : { added: 0, skipped: 0, errors: [] };

    const kResult = khubRows.length > 0
      ? await processKhubRows(client, khubRows, passout_year)
      : { added: 0, skipped: 0, errors: [] };

    const allErrors = [...pResult.errors, ...fResult.errors, ...kResult.errors];
    const totalAdded = pResult.added + fResult.added + kResult.added;
    const totalSkipped = pResult.skipped + fResult.skipped + kResult.skipped;

    // Log upload history for each type that had data
    if (placementRows.length > 0) {
      await client.query(
        `INSERT INTO upload_history (passout_year, upload_type, file_name, records_added, records_skipped, errors, uploaded_by)
         VALUES ($1, 'placements', $2, $3, $4, $5, $6)`,
        [passout_year, req.file.originalname, pResult.added, pResult.skipped, pResult.errors.length > 0 ? pResult.errors.join('\n') : null, req.user.id]
      );
    }
    if (fmmlRows.length > 0) {
      await client.query(
        `INSERT INTO upload_history (passout_year, upload_type, file_name, records_added, records_skipped, errors, uploaded_by)
         VALUES ($1, 'fmml', $2, $3, $4, $5, $6)`,
        [passout_year, req.file.originalname, fResult.added, fResult.skipped, fResult.errors.length > 0 ? fResult.errors.join('\n') : null, req.user.id]
      );
    }
    if (khubRows.length > 0) {
      await client.query(
        `INSERT INTO upload_history (passout_year, upload_type, file_name, records_added, records_skipped, errors, uploaded_by)
         VALUES ($1, 'khub', $2, $3, $4, $5, $6)`,
        [passout_year, req.file.originalname, kResult.added, kResult.skipped, kResult.errors.length > 0 ? kResult.errors.join('\n') : null, req.user.id]
      );
    }

    await client.query('COMMIT');

    // Refresh materialized views
    try { await pool.query('SELECT refresh_analytics()'); } catch (e) { /* ok if empty */ }

    res.json({
      message: 'Data uploaded successfully',
      summary: {
        placements: { rows: placementRows.length, added: pResult.added, skipped: pResult.skipped },
        fmml:       { rows: fmmlRows.length,      added: fResult.added, skipped: fResult.skipped },
        khub:       { rows: khubRows.length,       added: kResult.added, skipped: kResult.skipped },
      },
      total_added: totalAdded,
      total_skipped: totalSkipped,
      errors: allErrors.slice(0, 30),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Upload combined error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/upload/history — Get upload history
// ══════════════════════════════════════════════════════════════
router.get('/history', authenticate, async (req, res) => {
  try {
    const { passout_year } = req.query;
    let where = '';
    const params = [];
    if (passout_year) {
      where = 'WHERE h.passout_year = $1';
      params.push(parseInt(passout_year));
    }
    const result = await pool.query(`
      SELECT h.*, u.username, u.full_name AS uploaded_by_name
      FROM upload_history h
      LEFT JOIN users u ON u.id = h.uploaded_by
      ${where}
      ORDER BY h.uploaded_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Upload history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/upload/template — Download combined multi-sheet template
// ══════════════════════════════════════════════════════════════
router.get('/template', (req, res) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Placements  (branch & college auto-derived from roll_no)
  const pHeaders = [
    'roll_no', 'student_name', 'company_name', 'offer_type', 'ctc_lpa',
    'role', 'source', 'offer_date',
    'gender', 'tenth_pct', 'twelfth_pct', 'grad_cgpa', 'phone', 'email'
  ];
  const pSample = {
    roll_no: '22B21A0501', student_name: 'John Doe',
    company_name: 'TCS', offer_type: 'IT', ctc_lpa: 7.5,
    role: 'Software Engineer', source: 'On-Campus', offer_date: '2025-03-15',
    gender: 'Male', tenth_pct: 85.5, twelfth_pct: 78.3, grad_cgpa: 8.2,
    phone: '9876543210', email: 'john@example.com',
  };
  const pSample2 = {
    roll_no: '22JN1A0401', student_name: 'Jane Smith',
    company_name: 'Infosys', offer_type: 'Non-IT', ctc_lpa: 5.0,
    role: 'Analyst', source: 'On-Campus', offer_date: '2025-04-10',
    gender: 'Female', tenth_pct: 90.0, twelfth_pct: 88.5, grad_cgpa: 8.8,
    phone: '9876543211', email: 'jane@example.com',
  };
  const ws1 = XLSX.utils.json_to_sheet([pSample, pSample2], { header: pHeaders });
  ws1['!cols'] = pHeaders.map(h => ({ wch: Math.max(h.length + 2, 15) }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Placements');

  // Sheet 2: FMML  (branch & college auto-derived from roll_no)
  const fHeaders = [
    'roll_no', 'student_name',
    'fmml_batch', 'status', 'module_name', 'score', 'certificate_id', 'completion_date'
  ];
  const fSample = {
    roll_no: '22B21A0501', student_name: 'John Doe',
    fmml_batch: 'FMML-2025', status: 'Completed',
    module_name: 'Module 1', score: 85.0, certificate_id: 'FMML-CERT-001',
    completion_date: '2025-06-15',
  };
  const ws2 = XLSX.utils.json_to_sheet([fSample], { header: fHeaders });
  ws2['!cols'] = fHeaders.map(h => ({ wch: Math.max(h.length + 2, 15) }));
  XLSX.utils.book_append_sheet(wb, ws2, 'FMML');

  // Sheet 3: KHUB Placements  (branch & college auto-derived from roll_no)
  const kHeaders = [
    'roll_no', 'student_name', 'company_name', 'offer_type', 'ctc_lpa',
    'role', 'offer_date'
  ];
  const kSample = {
    roll_no: '22B21A0501', student_name: 'John Doe',
    company_name: 'Wipro', offer_type: 'IT', ctc_lpa: 5.0,
    role: 'Developer', offer_date: '2025-05-20',
  };
  const kSample2 = {
    roll_no: '226Q1A0301', student_name: 'Bob Wilson',
    company_name: 'L&T', offer_type: 'Non-IT', ctc_lpa: 4.5,
    role: 'Graduate Trainee', offer_date: '2025-06-01',
  };
  const ws3 = XLSX.utils.json_to_sheet([kSample, kSample2], { header: kHeaders });
  ws3['!cols'] = kHeaders.map(h => ({ wch: Math.max(h.length + 2, 15) }));
  XLSX.utils.book_append_sheet(wb, ws3, 'KHUB');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="batch_upload_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ══════════════════════════════════════════════════════════════
// DELETE /api/upload/data — Admin clears data by type & year
// ══════════════════════════════════════════════════════════════
router.delete('/data', authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { passout_year, type } = req.query;
    if (!passout_year || !type) {
      return res.status(400).json({ error: 'passout_year and type are required' });
    }
    const year = parseInt(passout_year);

    await client.query('BEGIN');
    let deleted = 0;

    if (type === 'placements') {
      const r = await client.query(
        `DELETE FROM placements WHERE source != 'KHUB' AND roll_no IN (SELECT roll_no FROM students WHERE passout_year = $1)`,
        [year]
      );
      deleted = r.rowCount;
    } else if (type === 'fmml') {
      const r = await client.query(
        'DELETE FROM fmml_participation WHERE roll_no IN (SELECT roll_no FROM students WHERE passout_year = $1)',
        [year]
      );
      deleted = r.rowCount;
    } else if (type === 'khub') {
      const r1 = await client.query(
        `DELETE FROM placements WHERE source = 'KHUB' AND roll_no IN (SELECT roll_no FROM students WHERE passout_year = $1)`,
        [year]
      );
      const r2 = await client.query(
        'DELETE FROM khub_participation WHERE roll_no IN (SELECT roll_no FROM students WHERE passout_year = $1)',
        [year]
      );
      deleted = r1.rowCount + r2.rowCount;
    } else if (type === 'all') {
      // Delete in dependency order: child tables first, then students
      const r1 = await client.query('DELETE FROM placements WHERE roll_no IN (SELECT roll_no FROM students WHERE passout_year = $1)', [year]);
      const r2 = await client.query('DELETE FROM fmml_participation WHERE roll_no IN (SELECT roll_no FROM students WHERE passout_year = $1)', [year]);
      const r3 = await client.query('DELETE FROM khub_participation WHERE roll_no IN (SELECT roll_no FROM students WHERE passout_year = $1)', [year]);
      const r4 = await client.query('DELETE FROM students WHERE passout_year = $1', [year]);
      await client.query('DELETE FROM upload_history WHERE passout_year = $1', [year]);
      deleted = r1.rowCount + r2.rowCount + r3.rowCount + r4.rowCount;
    } else {
      return res.status(400).json({ error: 'type must be placements, fmml, khub, or all' });
    }

    await client.query('COMMIT');
    try { await pool.query('SELECT refresh_analytics()'); } catch (e) { /* ok */ }

    res.json({ message: `Deleted ${deleted} ${type} records for batch ${year}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
