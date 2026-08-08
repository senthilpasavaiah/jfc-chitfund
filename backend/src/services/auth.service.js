const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../utils/jwt');

const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function register({ name, phone, email, password, role, whatsappNumber }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return withTransaction(async (client) => {
    const existing = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length) throw ApiError.conflict('An account with this phone number already exists');

    const userResult = await client.query(
      `INSERT INTO users (email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, phone, role, created_at`,
      [email || null, phone, passwordHash, role || 'MEMBER']
    );
    const user = userResult.rows[0];

    // Every user (of any role) gets a linked Member profile - admins/managers/
    // collectors are typically also chit participants in a friends-club setting.
    await client.query(
      `INSERT INTO members (user_id, name, mobile_number, whatsapp_number, email)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, name, phone, whatsappNumber || phone, email || null]
    );

    return user;
  });
}

async function login({ phone, password }, ipAddress) {
  const { rows } = await query('SELECT * FROM users WHERE phone = $1', [phone]);
  const user = rows[0];

  // Constant-ish response regardless of whether the account exists, to avoid
  // user enumeration - but we still need to compare against *something*.
  const dummyHash = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8ZpGoNMSAwYP8V9C1LpLoRHrpAO2Fu';
  const isMatch = await bcrypt.compare(password, user ? user.password_hash : dummyHash);

  if (!user) throw ApiError.unauthorized('Invalid phone number or password');

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minsLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw ApiError.forbidden(`Account locked due to repeated failed logins. Try again in ${minsLeft} minute(s).`);
  }

  if (!user.is_active) throw ApiError.forbidden('This account has been deactivated');

  if (!isMatch) {
    const failedCount = user.failed_login_count + 1;
    const shouldLock = failedCount >= MAX_FAILED_ATTEMPTS;
    await query(
      `UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3`,
      [
        shouldLock ? 0 : failedCount,
        shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60000) : null,
        user.id,
      ]
    );
    throw ApiError.unauthorized('Invalid phone number or password');
  }

  await query(
    `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE id = $1`,
    [user.id]
  );

  const safeUser = { id: user.id, email: user.email, phone: user.phone, role: user.role };
  const accessToken = signAccessToken(safeUser);
  const refreshToken = signRefreshToken(safeUser);

  const decoded = verifyRefreshToken(refreshToken);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, to_timestamp($3))`,
    [user.id, hashToken(refreshToken), decoded.exp]
  );

  return { user: safeUser, accessToken, refreshToken, mustChangePassword: user.must_change_password };
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const { rows } = await query(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2`,
    [tokenHash, payload.sub]
  );
  const stored = rows[0];
  if (!stored || stored.revoked_at) throw ApiError.unauthorized('Refresh token has been revoked');
  if (new Date(stored.expires_at) < new Date()) throw ApiError.unauthorized('Refresh token expired');

  const { rows: userRows } = await query(
    'SELECT id, email, phone, role, is_active FROM users WHERE id = $1',
    [payload.sub]
  );
  const user = userRows[0];
  if (!user || !user.is_active) throw ApiError.unauthorized('User account is inactive');

  // Rotate: revoke the old refresh token, issue a new pair.
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [stored.id]);

  const safeUser = { id: user.id, email: user.email, phone: user.phone, role: user.role };
  const newAccessToken = signAccessToken(safeUser);
  const newRefreshToken = signRefreshToken(safeUser);
  const decoded = verifyRefreshToken(newRefreshToken);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, to_timestamp($3))`,
    [user.id, hashToken(newRefreshToken), decoded.exp]
  );

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [hashToken(refreshToken)]);
}

async function changePassword(userId, currentPassword, newPassword) {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const user = rows[0];
  if (!user) throw ApiError.notFound('User not found');

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) throw ApiError.unauthorized('Current password is incorrect');

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = now() WHERE id = $2',
    [newHash, userId]
  );

  // Changing your password invalidates all existing refresh tokens (force re-login elsewhere).
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}

/**
 * Issues a password reset token. Returns the raw token so the caller (route
 * layer) can hand it to the notification service - only the hash is stored.
 * NOTE: no real SMS/email/WhatsApp is sent in this environment; see
 * services/notification.service.js.
 */
async function requestPasswordReset(phone) {
  const { rows } = await query('SELECT id FROM users WHERE phone = $1', [phone]);
  const user = rows[0];
  // Always behave the same way whether or not the account exists, to avoid
  // leaking which phone numbers are registered.
  if (!user) return null;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 60000); // 30 minutes

  await query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, tokenHash, expiresAt]
  );

  return { userId: user.id, rawToken };
}

async function resetPassword(rawToken, newPassword) {
  const tokenHash = hashToken(rawToken);
  const { rows } = await query(
    'SELECT * FROM password_reset_tokens WHERE token_hash = $1',
    [tokenHash]
  );
  const record = rows[0];
  if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
    throw ApiError.badRequest('Reset link is invalid or has expired');
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await withTransaction(async (client) => {
    await client.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
      newHash,
      record.user_id,
    ]);
    await client.query('UPDATE password_reset_tokens SET used_at = now() WHERE id = $1', [record.id]);
    await client.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [record.user_id]
    );
  });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  changePassword,
  requestPasswordReset,
  resetPassword,
};
