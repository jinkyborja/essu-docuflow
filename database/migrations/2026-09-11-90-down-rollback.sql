-- Full rollback. Safe while the original blob columns still exist (i.e. before
-- 03-finalize has been run).
SET FOREIGN_KEY_CHECKS = 0;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='requests' AND COLUMN_NAME='purpose_id');
SET @sql := IF(@c>0,'ALTER TABLE requests DROP FOREIGN KEY fk_requests_purpose, DROP COLUMN purpose_id','SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='program_id');
SET @sql := IF(@c>0,'ALTER TABLE users DROP FOREIGN KEY fk_users_program, DROP COLUMN program_id','SELECT 1');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

DROP TABLE IF EXISTS request_requirements;
DROP TABLE IF EXISTS document_requirements;
DROP TABLE IF EXISTS requirements;
DROP TABLE IF EXISTS purposes;
DROP TABLE IF EXISTS programs;

SET FOREIGN_KEY_CHECKS = 1;
