-- Required by student ID uploads, profile previews and staff ID review.
-- Add each nullable column only when absent, preserving existing photos and users.
SET @student_id_photo_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN id_photo_path VARCHAR(500) NULL DEFAULT NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id_photo_path'
);
PREPARE student_id_photo_stmt FROM @student_id_photo_sql;
EXECUTE student_id_photo_stmt;
DEALLOCATE PREPARE student_id_photo_stmt;

SET @student_id_photo_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN id_photo_uploaded_at TIMESTAMP NULL DEFAULT NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id_photo_uploaded_at'
);
PREPARE student_id_photo_stmt FROM @student_id_photo_sql;
EXECUTE student_id_photo_stmt;
DEALLOCATE PREPARE student_id_photo_stmt;
