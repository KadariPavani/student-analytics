-- Student Placement Analytics — Production Schema
-- PostgreSQL 14+

-- Drop existing objects
DROP MATERIALIZED VIEW IF EXISTS vw_branch_placement_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS vw_placement_overview CASCADE;
DROP VIEW IF EXISTS vw_fmml_impact CASCADE;
DROP VIEW IF EXISTS vw_khub_impact CASCADE;
DROP VIEW IF EXISTS vw_ctc_bands CASCADE;
DROP VIEW IF EXISTS vw_company_summary CASCADE;
DROP TABLE IF EXISTS upload_history CASCADE;
DROP TABLE IF EXISTS khub_participation CASCADE;
DROP TABLE IF EXISTS fmml_participation CASCADE;
DROP TABLE IF EXISTS placements CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS yearly_intake CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users (admin / user roles)
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    full_name     VARCHAR(100),
    created_at    TIMESTAMP DEFAULT NOW()
);

-- 2. Yearly Intake (per college + branch)
CREATE TABLE yearly_intake (
    id             SERIAL PRIMARY KEY,
    passout_year   INT NOT NULL,
    college        VARCHAR(10) NOT NULL CHECK (college IN ('KIET','KIEW','KIEK')),
    branch         VARCHAR(50) NOT NULL,
    total_students INT NOT NULL CHECK (total_students > 0),
    created_at     TIMESTAMP DEFAULT NOW(),
    UNIQUE(passout_year, college, branch)
);

-- 3. Students (master register keyed by roll number)
CREATE TABLE students (
    roll_no       VARCHAR(20) PRIMARY KEY,
    name          TEXT NOT NULL,
    college       VARCHAR(10) NOT NULL CHECK (college IN ('KIET','KIEW','KIEK')),
    branch        VARCHAR(50) NOT NULL,
    passout_year  INT NOT NULL,
    gender        VARCHAR(10) CHECK (gender IN ('Male','Female','Other')),
    tenth_pct     NUMERIC(5,2),
    twelfth_pct   NUMERIC(5,2),
    grad_cgpa     NUMERIC(4,2),
    phone         VARCHAR(15),
    email         VARCHAR(100),
    created_at    TIMESTAMP DEFAULT NOW()
);

-- 4. Placements (one student can have multiple offers)
CREATE TABLE placements (
    placement_id  SERIAL PRIMARY KEY,
    roll_no       VARCHAR(20) NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
    company_name  TEXT NOT NULL,
    ctc_lpa       NUMERIC(6,2) CHECK (ctc_lpa >= 0),
    offer_type    TEXT CHECK (offer_type IN ('IT','Non-IT','Core','NA')),
    role          TEXT,
    source        TEXT CHECK (source IN ('On-Campus','Off-Campus','Pool','KHUB')),
    offer_date    DATE
);

-- 5. FMML Participation
CREATE TABLE fmml_participation (
    id             SERIAL PRIMARY KEY,
    roll_no        VARCHAR(20) NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
    fmml_batch     TEXT,
    status         TEXT NOT NULL CHECK (status IN ('Enrolled','Completed','Dropped')),
    module_name    TEXT,
    score          NUMERIC(5,2),
    certificate_id TEXT,
    completion_date DATE,
    UNIQUE(roll_no, fmml_batch)
);

-- 6. KHUB Participation
CREATE TABLE khub_participation (
    id             SERIAL PRIMARY KEY,
    roll_no        VARCHAR(20) NOT NULL REFERENCES students(roll_no) ON DELETE CASCADE,
    activity_type  TEXT,
    club_name      TEXT DEFAULT 'KHUB',
    status         TEXT NOT NULL CHECK (status IN ('Active','Completed','Inactive')),
    points_earned  INT DEFAULT 0,
    completion_date DATE,
    remarks        TEXT,
    UNIQUE(roll_no, activity_type)
);

-- 7. Upload History (tracks all Excel uploads)
CREATE TABLE upload_history (
    id              SERIAL PRIMARY KEY,
    passout_year    INT NOT NULL,
    upload_type     VARCHAR(20) NOT NULL CHECK (upload_type IN ('placements','fmml','khub')),
    file_name       VARCHAR(255) NOT NULL,
    records_added   INT NOT NULL DEFAULT 0,
    records_skipped INT NOT NULL DEFAULT 0,
    errors          TEXT,
    uploaded_by     INT REFERENCES users(id),
    uploaded_at     TIMESTAMP DEFAULT NOW()
);

-- ===== Performance Indexes =====
CREATE INDEX idx_students_year       ON students(passout_year);
CREATE INDEX idx_students_branch     ON students(branch);
CREATE INDEX idx_students_college    ON students(college);
CREATE INDEX idx_placements_roll     ON placements(roll_no);
CREATE INDEX idx_placements_company  ON placements(company_name);
CREATE INDEX idx_placements_type     ON placements(offer_type);
CREATE INDEX idx_placements_ctc      ON placements(ctc_lpa);
CREATE UNIQUE INDEX idx_placements_dedup ON placements(roll_no, LOWER(company_name));
CREATE INDEX idx_fmml_roll           ON fmml_participation(roll_no);
CREATE INDEX idx_khub_roll           ON khub_participation(roll_no);
CREATE INDEX idx_intake_year         ON yearly_intake(passout_year);
CREATE INDEX idx_upload_year         ON upload_history(passout_year);
