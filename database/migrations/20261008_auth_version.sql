-- Apply before deploying the H06 authentication changes. Do not run against
-- production as part of local QA. Existing sessions and reset links require renewal.
ALTER TABLE users ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 0;
