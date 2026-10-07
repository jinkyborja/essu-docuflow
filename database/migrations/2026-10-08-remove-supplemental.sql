-- Move existing Supplemental students to Former before removing the enum value.
UPDATE users
SET student_type = 'Former'
WHERE student_type = 'Supplemental';

ALTER TABLE users
MODIFY COLUMN student_type ENUM('Enrolled', 'Former', 'Alumni');
