-- =============================================================================
-- Stage 2 — extract programs and purposes into lookup tables.
--
-- Existing free-text values that don't match the official list are preserved as
-- is_active = FALSE rows rather than dropped. Never silently lose data: those
-- students keep a valid program_id, and the inactive flag keeps the stale value
-- out of dropdowns and report filters.
-- =============================================================================

CREATE TABLE IF NOT EXISTS programs (
    program_id INT PRIMARY KEY AUTO_INCREMENT,
    code       VARCHAR(20)  NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    major      VARCHAR(100) NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT IGNORE INTO programs (code, name, major, is_active) VALUES
 ('MSHM-HRM','Master of Science in Hospitality Management (MSHM-HRM)','Hotel and Restaurant Management',TRUE),
 ('MAEd-EM','Master of Arts in Education – Educational Management','Educational Management',TRUE),
 ('MAEd-KE','Master of Arts in Education – Kindergarten Education','Kindergarten Education',TRUE),
 ('MAM','Master of Arts in Management (MAM)',NULL,TRUE),
 ('MAIT','Master of Arts in Industrial Technology (MAIT)',NULL,TRUE);

-- Preserve any stored program string that isn't on the official list.
INSERT IGNORE INTO programs (code, name, major, is_active)
SELECT SUBSTRING(CONCAT('LEGACY-', UPPER(REPLACE(u.program,' ','_'))), 1, 20), u.program, NULL, FALSE
FROM (SELECT DISTINCT program FROM users
      WHERE program IS NOT NULL AND program <> ''
        AND program NOT IN (SELECT name FROM programs)) u;

CREATE TABLE IF NOT EXISTS purposes (
    purpose_id INT PRIMARY KEY AUTO_INCREMENT,
    label      VARCHAR(50) NOT NULL UNIQUE,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT IGNORE INTO purposes (label, is_active) VALUES
 ('Employment',TRUE), ('Further Studies',TRUE), ('Promotion',TRUE), ('Personal/Other',TRUE);

INSERT IGNORE INTO purposes (label, is_active)
SELECT DISTINCT SUBSTRING(r.purpose,1,50), FALSE
FROM requests r
WHERE r.purpose IS NOT NULL AND r.purpose <> ''
  AND r.purpose NOT IN (SELECT label FROM purposes);

-- Add the FK columns and backfill from the existing text.
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='program_id');
SET @sql := IF(@c=0,'ALTER TABLE users ADD COLUMN program_id INT NULL AFTER program,
                      ADD CONSTRAINT fk_users_program FOREIGN KEY (program_id) REFERENCES programs(program_id)','SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

UPDATE users u JOIN programs p ON p.name = u.program SET u.program_id = p.program_id;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='requests' AND COLUMN_NAME='purpose_id');
SET @sql := IF(@c=0,'ALTER TABLE requests ADD COLUMN purpose_id INT NULL AFTER purpose,
                      ADD CONSTRAINT fk_requests_purpose FOREIGN KEY (purpose_id) REFERENCES purposes(purpose_id)','SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

UPDATE requests r JOIN purposes p ON p.label = r.purpose SET r.purpose_id = p.purpose_id;
