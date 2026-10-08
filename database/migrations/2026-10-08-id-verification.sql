-- Student ID verification for existing ESSU DocuFlow databases.
ALTER TABLE users
    ADD COLUMN id_status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
    ADD COLUMN id_verified_by INT NULL,
    ADD COLUMN id_verified_at TIMESTAMP NULL,
    ADD COLUMN id_reject_reason VARCHAR(300) NULL,
    ADD CONSTRAINT fk_users_id_verified_by FOREIGN KEY (id_verified_by)
        REFERENCES users(user_id) ON DELETE SET NULL;

-- The existing request history stream also stores standalone student/admin notices.
ALTER TABLE request_status_history
    ADD COLUMN notification_user_id INT NULL,
    ADD CONSTRAINT fk_history_notification_user FOREIGN KEY (notification_user_id)
        REFERENCES users(user_id) ON DELETE CASCADE;

-- Keep existing students able to use the system after this migration.
UPDATE users SET id_status = 'verified' WHERE role = 'Student';
-- To require review for everyone instead, run:
-- UPDATE users SET id_status = 'pending' WHERE role = 'Student';

-- Inspect duplicates and resolve them before adding the unique index.
SELECT student_id, COUNT(*) AS account_count
FROM users
WHERE role = 'Student' AND student_id IS NOT NULL
GROUP BY student_id
HAVING COUNT(*) > 1;

-- The base schema already declares student_id UNIQUE. If your deployed schema does
-- not, run this only after the duplicate query returns no rows:
-- ALTER TABLE users ADD UNIQUE INDEX uq_users_student_id (student_id);
