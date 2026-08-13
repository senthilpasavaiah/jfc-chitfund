-- Fixes a real production bug: the original seed script created a member
-- record ("Senthil Prabu (Admin)") linked to the system Admin's own login
-- account. This caused the Admin Access panel to show that record as a
-- "grantable/revokable" admin - and revoking it actually revoked the real
-- Admin's own access, since it's the same underlying login.

-- 1. Restore Admin role in case it was accidentally revoked via this bug.
UPDATE users SET role = 'ADMIN' WHERE login_username = 'Admin';

-- 2. Remove the bogus member record entirely - the Admin account isn't
--    supposed to have a linked member row at all (see the Admin Profile
--    page's own text: "isn't linked to any member or Aadhaar record").
DELETE FROM members
WHERE user_id = (SELECT id FROM users WHERE login_username = 'Admin');
