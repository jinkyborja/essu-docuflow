-- Normalize the live request schema used by multi-document submissions.
-- Inspect the live definitions first if you want to review the resolved types:
-- SHOW CREATE TABLE requests;
-- SHOW CREATE TABLE request_items;

-- Legacy single-document column must allow NULL because request_items is now authoritative.
-- The checked-in schema defines this column as INT.
ALTER TABLE requests MODIFY COLUMN document_id INT NULL;

-- Match request_items.request_id to the actual requests.request_id definition,
-- including its character set and collation. Drop/recreate its FK around the type change.
SET @schema_name = DATABASE();
SELECT COLUMN_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
  INTO @request_id_type, @request_id_charset, @request_id_collation
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'requests' AND COLUMN_NAME = 'request_id';

SELECT CONSTRAINT_NAME INTO @request_fk
  FROM information_schema.KEY_COLUMN_USAGE
 WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'request_items'
   AND COLUMN_NAME = 'request_id' AND REFERENCED_TABLE_NAME = 'requests'
 LIMIT 1;

SET @ddl = IF(@request_fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE request_items DROP FOREIGN KEY `', REPLACE(@request_fk, '`', '``'), '`'));
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = CONCAT(
  'ALTER TABLE request_items MODIFY COLUMN request_id ', @request_id_type, ' NOT NULL',
  IF(@request_id_charset IS NULL, '', CONCAT(' CHARACTER SET ', @request_id_charset)),
  IF(@request_id_collation IS NULL, '', CONCAT(' COLLATE ', @request_id_collation))
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = 'ALTER TABLE request_items ADD CONSTRAINT fk_request_items_request FOREIGN KEY (request_id) REFERENCES requests(request_id) ON DELETE CASCADE';
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
