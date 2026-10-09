-- =============================================================================
-- ESSU DocuFlow — Schema
-- =============================================================================

USE defaultdb;

-- Drop order matters: children before parents (FK constraints).
DROP TABLE IF EXISTS request_requirements;
DROP TABLE IF EXISTS document_requirements;
DROP TABLE IF EXISTS request_status_history;
DROP TABLE IF EXISTS request_items;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS requirements;
DROP TABLE IF EXISTS form_files;
DROP TABLE IF EXISTS forms;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS programs;
DROP TABLE IF EXISTS purposes;

-- 1. Programs ("Units of Education") — referenced by users.program_id
CREATE TABLE programs (
    program_id INT PRIMARY KEY AUTO_INCREMENT,
    code       VARCHAR(20)  NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    major      VARCHAR(100),
    is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. Purposes a document can be requested for
CREATE TABLE purposes (
    purpose_id INT PRIMARY KEY AUTO_INCREMENT,
    label      VARCHAR(50) NOT NULL UNIQUE,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. Requirement types, defined once and shared by every document
CREATE TABLE requirements (
    requirement_id INT PRIMARY KEY AUTO_INCREMENT,
    name           VARCHAR(100) NOT NULL UNIQUE,
    description    VARCHAR(255)
);

-- 4. Users
CREATE TABLE users (
    user_id          INT PRIMARY KEY AUTO_INCREMENT,
    first_name       VARCHAR(50) NOT NULL,
    middle_name      VARCHAR(50),
    last_name        VARCHAR(50) NOT NULL,
    date_of_birth    DATE,
    suffix           VARCHAR(10),
    email            VARCHAR(100) UNIQUE NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    auth_version     INT UNSIGNED NOT NULL DEFAULT 0,
    role             ENUM('Student', 'Staff', 'Admin') NOT NULL DEFAULT 'Student',
    student_id       VARCHAR(20) UNIQUE,
    program          VARCHAR(100),   -- legacy free text; program_id is authoritative
    program_id       INT,
    student_type     ENUM('Enrolled', 'Former', 'Alumni'),
    last_school_year INT,
    position         VARCHAR(50),
    verified         BOOLEAN DEFAULT FALSE,
    id_status        ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
    id_verified_by   INT NULL,
    id_verified_at   TIMESTAMP NULL,
    id_reject_reason VARCHAR(300) NULL,
    date_registered  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(program_id),
    FOREIGN KEY (id_verified_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 5. Documents (admin-managed list of requestable documents)
CREATE TABLE documents (
    document_id   INT PRIMARY KEY AUTO_INCREMENT,
    name          VARCHAR(100) NOT NULL,
    template_path VARCHAR(255),
    template_name VARCHAR(255),
    uploaded_by   INT NOT NULL,
    upload_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
);

-- 6. Requests
CREATE TABLE requests (
    request_id         VARCHAR(20) PRIMARY KEY,
    student_id         INT NOT NULL,
    document_id        INT NULL,
    purpose            VARCHAR(255),   -- legacy free text; purpose_id is authoritative
    purpose_id         INT,
    status             ENUM('Pending', 'Approved', 'Rejected', 'Correction Requested') DEFAULT 'Pending',
    admin_message      TEXT,
    approved_file_path VARCHAR(255),
    approved_file_name VARCHAR(255),
    date_requested     DATETIME DEFAULT CURRENT_TIMESTAMP,
    staff_viewed       BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (student_id) REFERENCES users(user_id),
    FOREIGN KEY (document_id) REFERENCES documents(document_id),
    FOREIGN KEY (purpose_id) REFERENCES purposes(purpose_id)
);

CREATE TABLE request_items (
    item_id      INT PRIMARY KEY AUTO_INCREMENT,
    request_id   VARCHAR(20) NOT NULL,
    document_id  INT NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_request_items_request_document (request_id, document_id),
    FOREIGN KEY (request_id) REFERENCES requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(document_id)
);
-- Keep request_items.request_id identical to requests.request_id (VARCHAR(20));
-- requests.document_id stays nullable for legacy compatibility with multi-document requests.

-- 7. Which requirements each document asks for
CREATE TABLE document_requirements (
    document_id    INT NOT NULL,
    requirement_id INT NOT NULL,
    in_person      BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order     INT NOT NULL DEFAULT 0,
    PRIMARY KEY (document_id, requirement_id),
    FOREIGN KEY (document_id)    REFERENCES documents(document_id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES requirements(requirement_id)
);

-- 8. What a student submitted against each requirement
CREATE TABLE request_requirements (
    request_id       VARCHAR(20) NOT NULL,
    requirement_id   INT NOT NULL,
    in_person        BOOLEAN NOT NULL DEFAULT FALSE,
    file_path        VARCHAR(255),
    file_name        VARCHAR(255),
    submitted_at     DATETIME,
    needs_correction BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order       INT NOT NULL DEFAULT 0,
    PRIMARY KEY (request_id, requirement_id),
    FOREIGN KEY (request_id)     REFERENCES requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES requirements(requirement_id)
);

-- 9. Request Status History
CREATE TABLE request_status_history (
    history_id   INT PRIMARY KEY AUTO_INCREMENT,
    request_id   VARCHAR(20),
    old_status   VARCHAR(50),
    new_status   VARCHAR(50),
    changed_by   INT,
    changed_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,  -- staff read flag
    student_read BOOLEAN NOT NULL DEFAULT FALSE,  -- student read flag
    notification_user_id INT NULL,
    FOREIGN KEY (request_id) REFERENCES requests(request_id),
    FOREIGN KEY (changed_by) REFERENCES users(user_id),
    FOREIGN KEY (notification_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Forms catalog (also available as database/migrations/2026-10-07-forms.sql)
CREATE TABLE forms (
    form_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    code VARCHAR(100) NULL,
    description TEXT NOT NULL,
    fields JSON NOT NULL,
    download_name VARCHAR(255) NOT NULL,
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE form_files (
    file_id INT PRIMARY KEY AUTO_INCREMENT,
    form_id INT NOT NULL,
    page_no INT NOT NULL,
    storage_path VARCHAR(512) NULL,
    public_url VARCHAR(1024) NOT NULL,
    FOREIGN KEY (form_id) REFERENCES forms(form_id) ON DELETE CASCADE
);

-- forms.form_id is signed INT in db.sql; no character collation applies.
ALTER TABLE requirements
    ADD COLUMN form_id INT NULL,
    ADD COLUMN needs_signature BOOLEAN NULL DEFAULT 0,
    ADD COLUMN signature_note VARCHAR(200) NULL,
    ADD CONSTRAINT fk_requirements_form
        FOREIGN KEY (form_id) REFERENCES forms(form_id) ON DELETE SET NULL;

INSERT INTO forms (title, category, code, description, fields, download_name) VALUES
('Certificate of Registration', 'Registration', NULL, 'Certificate of Registration form.', JSON_ARRAY(), 'ESSU-Certificate-of-Registration'),
('Clearance Credential', 'Clearance', NULL, 'Clearance Credential form.', JSON_ARRAY(), 'ESSU-Clearance-Credential'),
('Grade Change Request', 'Academic Records', NULL, 'Request for a grade change.', JSON_ARRAY(), 'ESSU-Grade-Change-Request'),
('MAEd Educational Management Evaluation', 'Evaluation', NULL, 'Evaluation form for MAEd Educational Management.', JSON_ARRAY(), 'ESSU-MAEd-Educational-Management-Evaluation'),
('MAEd Kindergarten Evaluation', 'Evaluation', NULL, 'Evaluation form for MAEd Kindergarten.', JSON_ARRAY(), 'ESSU-MAEd-Kindergarten-Evaluation'),
('MAIT Evaluation', 'Evaluation', NULL, 'Evaluation form for MAIT.', JSON_ARRAY(), 'ESSU-MAIT-Evaluation'),
('MAM Evaluation', 'Evaluation', NULL, 'Evaluation form for MAM.', JSON_ARRAY(), 'ESSU-MAM-Evaluation'),
('MSHM Evaluation', 'Evaluation', NULL, 'Evaluation form for MSHM.', JSON_ARRAY(), 'ESSU-MSHM-Evaluation');

INSERT INTO form_files (form_id, page_no, storage_path, public_url)
SELECT form_id, 1, NULL, '/forms/certificate-of-registration-1.jpg.jpg' FROM forms WHERE title = 'Certificate of Registration';
INSERT INTO form_files (form_id, page_no, storage_path, public_url)
SELECT form_id, 2, NULL, '/forms/certificate-of-registration-2.jpg.jpg' FROM forms WHERE title = 'Certificate of Registration';
INSERT INTO form_files (form_id, page_no, storage_path, public_url)
SELECT form_id, 1, NULL, '/forms/clearance-credential-1.jpg.jpg' FROM forms WHERE title = 'Clearance Credential';
INSERT INTO form_files (form_id, page_no, storage_path, public_url)
SELECT form_id, 2, NULL, '/forms/clearance-credential-2.jpg.jpg' FROM forms WHERE title = 'Clearance Credential';
INSERT INTO form_files (form_id, page_no, storage_path, public_url)
SELECT form_id, 1, NULL, '/forms/request-grade-change.jpg.jpg' FROM forms WHERE title = 'Grade Change Request';
INSERT INTO form_files (form_id, page_no, storage_path, public_url)
SELECT form_id, 1, NULL, '/forms/eval-maed-em.jpg.jpg' FROM forms WHERE title = 'MAEd Educational Management Evaluation';
INSERT INTO form_files (form_id, page_no, storage_path, public_url)
SELECT form_id, 1, NULL, '/forms/eval-maed-kinder.jpg.jpg' FROM forms WHERE title = 'MAEd Kindergarten Evaluation';
INSERT INTO form_files (form_id, page_no, storage_path, public_url)
SELECT form_id, 1, NULL, '/forms/eval-mait.jpg.jpg' FROM forms WHERE title = 'MAIT Evaluation';
INSERT INTO form_files (form_id, page_no, storage_path, public_url)
SELECT form_id, 1, NULL, '/forms/eval-mam.jpg.jpg' FROM forms WHERE title = 'MAM Evaluation';
INSERT INTO form_files (form_id, page_no, storage_path, public_url)
SELECT form_id, 1, NULL, '/forms/eval-mshm.jpg.jpg' FROM forms WHERE title = 'MSHM Evaluation';
