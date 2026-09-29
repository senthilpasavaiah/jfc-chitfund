-- Multiple contributions are valid: the same member may hold more than one slot
-- in a chit. The original schema enforced UNIQUE(chit_id, member_id), which
-- conflicts with the current application/payment model. Remove that legacy
-- constraint safely by matching its definition rather than assuming a name.
BEGIN;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname
    INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE rel.relname = 'chit_members'
    AND con.contype = 'u'
    AND pg_get_constraintdef(con.oid) = 'UNIQUE (chit_id, member_id)'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE chit_members DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chit_members_chit_member
  ON chit_members(chit_id, member_id);

COMMIT;
