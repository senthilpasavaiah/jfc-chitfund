-- Isolated test workspace for notification/payment workflow testing.
-- Test chits and members are excluded from normal business views/aggregates.
ALTER TABLE chits ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_chits_is_test ON chits(is_test);
CREATE INDEX IF NOT EXISTS idx_members_is_test ON members(is_test);
