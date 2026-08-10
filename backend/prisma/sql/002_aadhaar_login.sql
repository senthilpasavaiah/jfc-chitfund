-- Adds support for Aadhaar-last-4 based member login and a dedicated
-- text username for the Admin account, alongside the existing phone-based
-- login. password_hash becomes nullable because a member's linked user
-- account is created up front (when the member record is created) but has
-- no password until they complete first-time login.

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_username TEXT UNIQUE;

-- Give the seeded admin account the literal username "Admin"
UPDATE users SET login_username = 'Admin' WHERE phone = '9000000001' AND role = 'ADMIN';
