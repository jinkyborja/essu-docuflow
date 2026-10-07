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

-- Legacy static forms from the original Forms catalog. The two registration
-- and clearance forms each have two pages; evaluation forms have one page.
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
