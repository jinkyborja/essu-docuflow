-- Adds cancellation and archive metadata without replacing existing status values.
-- Re-runnable on MySQL; existing rows, deliverables and history remain intact.
SET @schema_name = DATABASE();
SET @status_type = (SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'requests' AND COLUMN_NAME = 'status');
SET @status_nullable = (SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'requests' AND COLUMN_NAME = 'status');
SET @status_default = (SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'requests' AND COLUMN_NAME = 'status');
SET @status_sql = IF(LOWER(@status_type) LIKE 'enum(%' AND LOCATE('''cancelled''', LOWER(@status_type)) = 0,
    CONCAT('ALTER TABLE requests MODIFY COLUMN status ', LEFT(@status_type, LENGTH(@status_type) - 1), ',''Cancelled'') ',
        IF(@status_nullable = 'YES', 'NULL', 'NOT NULL'),
        IF(@status_default IS NULL, IF(@status_nullable = 'YES', ' DEFAULT NULL', ''), CONCAT(' DEFAULT ', QUOTE(@status_default)))), 'SELECT 1');
PREPARE lifecycle_stmt FROM @status_sql;
EXECUTE lifecycle_stmt;
DEALLOCATE PREPARE lifecycle_stmt;

SET @archive_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'requests' AND COLUMN_NAME = 'archived_at'),
    'SELECT 1', 'ALTER TABLE requests ADD COLUMN archived_at DATETIME NULL DEFAULT NULL');
PREPARE lifecycle_stmt FROM @archive_sql;
EXECUTE lifecycle_stmt;
DEALLOCATE PREPARE lifecycle_stmt;

SET @actor_sql = IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'requests' AND COLUMN_NAME = 'archived_by'),
    'SELECT 1', 'ALTER TABLE requests ADD COLUMN archived_by INT NULL DEFAULT NULL');
PREPARE lifecycle_stmt FROM @actor_sql;
EXECUTE lifecycle_stmt;
DEALLOCATE PREPARE lifecycle_stmt;
