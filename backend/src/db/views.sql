-- Materialized Views & Views for Placement Analytics

-- ===== 1. Placement overview per batch =====
CREATE MATERIALIZED VIEW IF NOT EXISTS vw_placement_overview AS
SELECT
    yi.passout_year,
    SUM(yi.total_students)                              AS total_students,
    COUNT(DISTINCT CASE WHEN p.source IN ('On-Campus','Off-Campus','Pool') THEN p.roll_no END) AS placed_students,
    ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.source IN ('On-Campus','Off-Campus','Pool') THEN p.roll_no END)
      / NULLIF(SUM(yi.total_students), 0), 2) AS placement_rate_pct,
    COUNT(DISTINCT CASE WHEN p.offer_type = 'IT'     THEN p.roll_no END) AS it_placed,
    COUNT(DISTINCT CASE WHEN p.offer_type = 'Non-IT' THEN p.roll_no END) AS non_it_placed,
    ROUND(MAX(p.ctc_lpa), 2)                            AS max_ctc,
    ROUND(MIN(p.ctc_lpa), 2)                            AS min_ctc,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.ctc_lpa)::NUMERIC, 2) AS median_ctc
FROM yearly_intake yi
LEFT JOIN students s  ON s.passout_year = yi.passout_year AND s.college = yi.college AND s.branch = yi.branch
LEFT JOIN placements p ON p.roll_no = s.roll_no AND UPPER(TRIM(COALESCE(p.company_name,''))) NOT IN ('NA','N/A','N.A','N.A.','NONE','NIL','-','--','NA.')
GROUP BY yi.passout_year
ORDER BY yi.passout_year;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vw_placement_overview
    ON vw_placement_overview(passout_year);

-- ===== 2. Branch-wise placement summary =====
CREATE MATERIALIZED VIEW IF NOT EXISTS vw_branch_placement_summary AS
WITH intake AS (
    SELECT branch, college, passout_year, SUM(total_students) AS total_students
    FROM yearly_intake
    GROUP BY branch, college, passout_year
),
placed AS (
    SELECT s.branch, s.college, s.passout_year,
        COUNT(DISTINCT p.roll_no) AS placed_students,
        COUNT(DISTINCT CASE WHEN p.source IN ('On-Campus','Off-Campus','Pool') THEN p.roll_no END) AS campus_placed,
        ROUND(MAX(p.ctc_lpa), 2) AS max_ctc
    FROM students s
    JOIN placements p ON p.roll_no = s.roll_no
    GROUP BY s.branch, s.college, s.passout_year
),
fmml AS (
    SELECT s.branch, s.college, s.passout_year,
        COUNT(DISTINCT f.roll_no) AS fmml_placed
    FROM fmml_participation f
    JOIN placements p ON p.roll_no = f.roll_no
    JOIN students s ON s.roll_no = f.roll_no
    GROUP BY s.branch, s.college, s.passout_year
),
khub AS (
    SELECT s.branch, s.college, s.passout_year,
        COUNT(DISTINCT kp.roll_no) AS khub_students
    FROM khub_participation kp
    JOIN placements p ON p.roll_no = kp.roll_no
    JOIN students s ON s.roll_no = kp.roll_no
    GROUP BY s.branch, s.college, s.passout_year
)
SELECT
    i.branch,
    i.passout_year,
    i.college,
    i.total_students,
    COALESCE(pl.campus_placed, 0) AS placed_students,
    COALESCE(fm.fmml_placed, 0) AS fmml_placed,
    COALESCE(kh.khub_students, 0) AS khub_students,
    COALESCE(fm.fmml_placed, 0) AS fmml_and_placed,
    COALESCE(kh.khub_students, 0) AS khub_and_placed,
    pl.max_ctc
FROM intake i
LEFT JOIN placed pl ON pl.branch = i.branch AND pl.college = i.college AND pl.passout_year = i.passout_year
LEFT JOIN fmml fm ON fm.branch = i.branch AND fm.college = i.college AND fm.passout_year = i.passout_year
LEFT JOIN khub kh ON kh.branch = i.branch AND kh.college = i.college AND kh.passout_year = i.passout_year
ORDER BY i.passout_year, i.branch;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vw_branch_summary
    ON vw_branch_placement_summary(branch, passout_year, college);

-- ===== 3. FMML impact view (only FMML students who are placed) =====
CREATE OR REPLACE VIEW vw_fmml_impact AS
WITH fmml_placed AS (
    SELECT DISTINCT f.roll_no
    FROM fmml_participation f
    JOIN placements p ON p.roll_no = f.roll_no
)
SELECT
    CASE WHEN fp.roll_no IS NOT NULL THEN 1 ELSE 0 END AS is_fmml,
    COUNT(DISTINCT p.roll_no)       AS placed_students,
    ROUND(MAX(p.ctc_lpa), 2)       AS max_ctc,
    ROUND(MIN(p.ctc_lpa), 2)       AS min_ctc,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.ctc_lpa)::NUMERIC, 2) AS median_ctc,
    COUNT(DISTINCT CASE WHEN p.offer_type = 'IT' THEN p.roll_no END) AS it_offers,
    COUNT(DISTINCT CASE WHEN p.offer_type = 'Non-IT' THEN p.roll_no END) AS non_it_offers
FROM (SELECT * FROM placements WHERE UPPER(TRIM(COALESCE(company_name,''))) NOT IN ('NA','N/A','N.A','N.A.','NONE','NIL','-','--','NA.')) p
LEFT JOIN fmml_placed fp ON fp.roll_no = p.roll_no
GROUP BY CASE WHEN fp.roll_no IS NOT NULL THEN 1 ELSE 0 END;

-- ===== 4. KHUB impact view =====
CREATE OR REPLACE VIEW vw_khub_impact AS
WITH khub_placed AS (
    SELECT DISTINCT kp.roll_no
    FROM khub_participation kp
    JOIN placements p ON p.roll_no = kp.roll_no
)
SELECT
    CASE WHEN kp.roll_no IS NOT NULL THEN 1 ELSE 0 END AS is_khub,
    COUNT(DISTINCT p.roll_no)       AS placed_students,
    ROUND(MAX(p.ctc_lpa), 2)       AS max_ctc,
    ROUND(MIN(p.ctc_lpa), 2)       AS min_ctc,
    COUNT(DISTINCT CASE WHEN p.offer_type = 'IT' THEN p.roll_no END) AS it_offers
FROM (SELECT * FROM placements WHERE UPPER(TRIM(COALESCE(company_name,''))) NOT IN ('NA','N/A','N.A','N.A.','NONE','NIL','-','--','NA.')) p
LEFT JOIN khub_placed kp ON kp.roll_no = p.roll_no
GROUP BY CASE WHEN kp.roll_no IS NOT NULL THEN 1 ELSE 0 END;

-- ===== 5. CTC band distribution =====
CREATE OR REPLACE VIEW vw_ctc_bands AS
SELECT
    CASE
        WHEN p.ctc_lpa >= 20  THEN '20+ LPA'
        WHEN p.ctc_lpa >= 12  THEN '12-20 LPA'
        WHEN p.ctc_lpa >= 8   THEN '8-12 LPA'
        WHEN p.ctc_lpa >= 5   THEN '5-8 LPA'
        WHEN p.ctc_lpa >= 3   THEN '3-5 LPA'
        ELSE 'Below 3 LPA'
    END AS salary_band,
    COUNT(*)                   AS offer_count,
    COUNT(DISTINCT p.roll_no)  AS student_count,
    CASE
        WHEN p.ctc_lpa >= 20  THEN 6
        WHEN p.ctc_lpa >= 12  THEN 5
        WHEN p.ctc_lpa >= 8   THEN 4
        WHEN p.ctc_lpa >= 5   THEN 3
        WHEN p.ctc_lpa >= 3   THEN 2
        ELSE 1
    END AS band_order
FROM placements p WHERE UPPER(TRIM(COALESCE(p.company_name,''))) NOT IN ('NA','N/A','N.A','N.A.','NONE','NIL','-','--','NA.')
GROUP BY salary_band, band_order
ORDER BY band_order DESC;

-- ===== 6. Company-wise summary =====
CREATE OR REPLACE VIEW vw_company_summary AS
SELECT
    p.company_name,
    p.offer_type,
    COUNT(*)                    AS total_offers,
    COUNT(DISTINCT p.roll_no)   AS unique_students,
    ROUND(MAX(p.ctc_lpa), 2)   AS max_ctc,
    COUNT(DISTINCT CASE WHEN f.roll_no IS NOT NULL THEN p.roll_no END) AS fmml_students,
    COUNT(DISTINCT CASE WHEN kp.roll_no IS NOT NULL THEN p.roll_no END) AS khub_students
FROM (SELECT * FROM placements WHERE UPPER(TRIM(COALESCE(company_name,''))) NOT IN ('NA','N/A','N.A','N.A.','NONE','NIL','-','--','NA.')) p
LEFT JOIN fmml_participation f ON f.roll_no = p.roll_no
LEFT JOIN khub_participation kp ON kp.roll_no = p.roll_no
GROUP BY p.company_name, p.offer_type
ORDER BY total_offers DESC;
