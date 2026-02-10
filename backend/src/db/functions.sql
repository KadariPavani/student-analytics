-- PL/pgSQL helper functions

-- Refresh all materialized views (call after data upload)
CREATE OR REPLACE FUNCTION refresh_analytics()
RETURNS VOID AS $$
BEGIN
    -- Try CONCURRENTLY first; fall back to non-concurrent for empty/first-time views
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY vw_placement_overview;
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW vw_placement_overview;
    END;
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY vw_branch_placement_summary;
    EXCEPTION WHEN OTHERS THEN
        REFRESH MATERIALIZED VIEW vw_branch_placement_summary;
    END;
END;
$$ LANGUAGE plpgsql;

-- Get complete student placement + program profile
CREATE OR REPLACE FUNCTION get_student_profile(p_roll_no VARCHAR)
RETURNS TABLE(
    roll_no       VARCHAR,
    name          TEXT,
    college       VARCHAR,
    branch        VARCHAR,
    passout_year  INT,
    gender        VARCHAR,
    tenth_pct     NUMERIC,
    twelfth_pct   NUMERIC,
    grad_cgpa     NUMERIC,
    company_name  TEXT,
    ctc_lpa       NUMERIC,
    offer_type    TEXT,
    role          TEXT,
    source        TEXT,
    offer_date    DATE,
    fmml_status   TEXT,
    fmml_batch    TEXT,
    fmml_score    NUMERIC,
    khub_status   TEXT,
    khub_club     TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.roll_no,
        s.name,
        s.college,
        s.branch,
        s.passout_year,
        s.gender,
        s.tenth_pct,
        s.twelfth_pct,
        s.grad_cgpa,
        p.company_name,
        p.ctc_lpa,
        p.offer_type,
        p.role,
        p.source,
        p.offer_date,
        f.status,
        f.fmml_batch,
        f.score,
        k.status,
        k.club_name
    FROM students s
    LEFT JOIN placements p          ON p.roll_no = s.roll_no
    LEFT JOIN fmml_participation f  ON f.roll_no = s.roll_no
    LEFT JOIN khub_participation k  ON k.roll_no = s.roll_no
    WHERE s.roll_no = p_roll_no
    ORDER BY p.ctc_lpa DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;
