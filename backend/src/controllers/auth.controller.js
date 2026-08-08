const authService = require('../services/auth.service');
const notificationService = require('../services/notification.service');
const { recordAudit } = require('../utils/audit');

const REFRESH_COOKIE_NAME = 'jfc_refresh_token';
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

async function register(req, res) {
  const user = await authService.register(req.body);
  await recordAudit({
    userId: user.id,
    action: 'USER_REGISTER',
    entityType: 'User',
    entityId: user.id,
    ipAddress: req.ip,
  });
  res.status(201).json({ success: true, data: user });
}

async function login(req, res) {
  const result = await authService.login(req.body, req.ip);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTS);
  await recordAudit({ userId: result.user.id, action: 'USER_LOGIN', entityType: 'User', entityId: result.user.id, ipAddress: req.ip });
  res.json({
    success: true,
    data: {
      user: result.user,
      accessToken: result.accessToken,
      mustChangePassword: result.mustChangePassword,
    },
  });
}

async function refresh(req, res) {
  const token = req.cookies[REFRESH_COOKIE_NAME] || req.body.refreshToken;
  const result = await authService.refresh(token);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTS);
  res.json({ success: true, data: { accessToken: result.accessToken } });
}

async function logout(req, res) {
  const token = req.cookies[REFRESH_COOKIE_NAME] || req.body.refreshToken;
  await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.json({ success: true, message: 'Logged out' });
}

async function changePassword(req, res) {
  await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  await recordAudit({ userId: req.user.id, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: req.user.id, ipAddress: req.ip });
  res.json({ success: true, message: 'Password updated successfully' });
}

async function forgotPassword(req, res) {
  const result = await authService.requestPasswordReset(req.body.phone);
  if (result) {
    // No live SMS/WhatsApp provider is connected in this build - the reset
    // "message" is logged to the notifications table instead of sent.
    await notificationService.dispatch({
      memberId: null,
      channel: 'SMS',
      type: 'GENERAL',
      subject: 'Password reset requested',
      body: `Your password reset token: ${result.rawToken} (valid 30 minutes)`,
      createdById: result.userId,
    });
  }
  // Always return the same response whether or not the phone number exists.
  res.json({ success: true, message: 'If that account exists, a reset link has been logged.' });
}

async function resetPassword(req, res) {
  await authService.resetPassword(req.body.token, req.body.newPassword);
  res.json({ success: true, message: 'Password has been reset. Please log in.' });
}

async function me(req, res) {
  res.json({ success: true, data: req.user });
}

module.exports = { register, login, refresh, logout, changePassword, forgotPassword, resetPassword, me };
