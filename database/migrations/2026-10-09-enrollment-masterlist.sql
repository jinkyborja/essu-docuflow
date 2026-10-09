-- users.student_id is VARCHAR(20); both tables inherit database charset/collation.
CREATE TABLE enrollment_masterlist (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50) NULL,
    program VARCHAR(200) NOT NULL,
    campus VARCHAR(50) DEFAULT 'Guiuan',
    status VARCHAR(30) NULL,
    school_year VARCHAR(20) NULL,
    imported_by INT NULL,
    imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (imported_by) REFERENCES users(user_id) ON DELETE SET NULL
);

ALTER TABLE users ADD COLUMN id_verification_note VARCHAR(300) NULL;
