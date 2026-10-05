-- =============================================================================
-- ESSU DocuFlow — Seed Data
-- =============================================================================

USE defaultdb;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE request_status_history;
TRUNCATE TABLE requests;
TRUNCATE TABLE documents;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO users (user_id, first_name, middle_name, last_name, date_of_birth, email, password_hash, role, student_id, program, student_type, last_school_year, position, verified, date_registered) VALUES
(1,  'Jhon',    NULL,    'Doe',       NULL,         'admin@gmail.com',              '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'Admin',   NULL,       NULL,   NULL,          NULL, 'Office Administrator', TRUE, '2023-06-01 08:00:00'),
(2,  'Jane',    NULL,    'Doe',       NULL,         'jane.doe@essu.edu.ph',         'ef92b778bafe771207463574d9abbde9cfe5e91d84a78b1b13b4c0be4e0a6e3c', 'Staff',   NULL,       NULL,   NULL,          NULL, 'Registrar Staff',      TRUE, '2023-06-01 08:00:00'),
(3,  'John',    NULL,    'Smith',     NULL,         'john.smith@essu.edu.ph',       'ef92b778bafe771207463574d9abbde9cfe5e91d84a78b1b13b4c0be4e0a6e3c', 'Staff',   NULL,       NULL,   NULL,          NULL, 'Document Processor',   TRUE, '2023-06-01 08:00:00'),
(4,  'Juan',    'Dela',  'Cruz',      '2001-03-15', 'juan.delacruz@essu.edu.ph',    'ef92b778bafe771207463574d9abbde9cfe5e91d84a78b1b13b4c0be4e0a6e3c', 'Student', '22-0123', 'MIT',  'Enrolled',    NULL, NULL, TRUE, '2022-08-10 09:00:00'),
(5,  'Maria',   NULL,    'Santos',    '2000-07-22', 'maria.santos@essu.edu.ph',     'ef92b778bafe771207463574d9abbde9cfe5e91d84a78b1b13b4c0be4e0a6e3c', 'Student', '21-0456', 'MAEd', 'Former',      2024, NULL, TRUE, '2021-08-12 09:00:00');
