-- 001_add_is_admin
--
-- Add is_admin boolean to users + a partial index. Idempotent — safe to run
-- against a database where the column already exists.
--
-- Apply with: psql $DATABASE_URL -f scripts/migrations/001_add_is_admin.sql

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_admin
  ON users(is_admin)
  WHERE is_admin = true;

-- Demo bootstrap: promote the first user (lowest created_at) to admin so
-- /admin/platform isn't locked out after the column rolls in. Skipped when
-- there are no users (fresh db).
UPDATE users
   SET is_admin = true
 WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
   AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = true);

COMMIT;
