-- Correct one member's spelling without changing their member ID or related records.
-- Run against the production Neon database after taking a backup.
BEGIN;
DO $$
DECLARE
  matched_count integer;
BEGIN
  SELECT COUNT(*) INTO matched_count
  FROM members
  WHERE name = 'Ramaswamy pandian R';

  IF matched_count = 0 THEN
    RAISE EXCEPTION 'No member found with exact old name: Ramaswamy pandian R';
  ELSIF matched_count > 1 THEN
    RAISE EXCEPTION 'Found % members with exact old name; refusing ambiguous update', matched_count;
  END IF;

  UPDATE members
  SET name = 'Ramasamy pandian R', updated_at = NOW()
  WHERE name = 'Ramaswamy pandian R';
END $$;

-- Verify the correction before committing.
SELECT id, name, mobile_number
FROM members
WHERE name IN ('Ramaswamy pandian R', 'Ramasamy pandian R');
COMMIT;
