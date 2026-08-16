-- A member can hold more than one slot in the same chit (common in real
-- chit funds - a well-off member takes multiple "shares"). Previously
-- UNIQUE(chit_id, member_id) blocked this - each slot is now independent,
-- uniqueness only applies per slot number (one person per slot, but a
-- person can occupy several different slots).
ALTER TABLE chit_members DROP CONSTRAINT IF EXISTS chit_members_chit_id_member_id_key;
ALTER TABLE chit_members ADD CONSTRAINT chit_members_chit_id_slot_number_key UNIQUE (chit_id, slot_number);
