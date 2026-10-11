-- Preserve existing accounts without assuming their campus from other records.
SET @student_campus_sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN campus VARCHAR(50) NULL DEFAULT NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'campus'
);
PREPARE student_campus_stmt FROM @student_campus_sql;
EXECUTE student_campus_stmt;
DEALLOCATE PREPARE student_campus_stmt;
