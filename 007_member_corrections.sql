-- Corrections: real phone numbers for two members, and ensure
-- Senthil prabu Pasavaiah is a regular MEMBER (not accidentally an admin).

-- Jothiveerarajan C: had no phone on file (imported as PENDING-1), now has a
-- real number. Give them a proper linked login account.
DO $$
DECLARE
  v_member_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id, user_id INTO v_member_id, v_user_id FROM members WHERE name = 'Jothiveerarajan C';

  IF v_member_id IS NULL THEN
    RAISE NOTICE 'Member "Jothiveerarajan C" not found - skipping';
  ELSIF v_user_id IS NULL THEN
    INSERT INTO users (phone, role) VALUES ('+91995039949', 'MEMBER') RETURNING id INTO v_user_id;
    UPDATE members SET user_id = v_user_id, mobile_number = '+91995039949', whatsapp_number = '+91995039949'
    WHERE id = v_member_id;
  ELSE
    UPDATE members SET mobile_number = '+91995039949', whatsapp_number = '+91995039949' WHERE id = v_member_id;
    UPDATE users SET phone = '+91995039949' WHERE id = v_user_id;
  END IF;
END $$;

-- Senthil prabu Pasavaiah: update to their real phone number, and make sure
-- their account role is MEMBER (this is a real roster member, not the
-- system Admin account).
DO $$
DECLARE
  v_member_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id, user_id INTO v_member_id, v_user_id FROM members WHERE name = 'Senthil prabu Pasavaiah';

  IF v_member_id IS NULL THEN
    RAISE NOTICE 'Member "Senthil prabu Pasavaiah" not found - skipping';
  ELSIF v_user_id IS NULL THEN
    INSERT INTO users (phone, role) VALUES ('+919841340573', 'MEMBER') RETURNING id INTO v_user_id;
    UPDATE members SET user_id = v_user_id, mobile_number = '+919841340573', whatsapp_number = '+919841340573'
    WHERE id = v_member_id;
  ELSE
    UPDATE members SET mobile_number = '+919841340573', whatsapp_number = '+919841340573' WHERE id = v_member_id;
    UPDATE users SET phone = '+919841340573', role = 'MEMBER' WHERE id = v_user_id;
  END IF;
END $$;
