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

/** Admin login: "Admin" (or any reserved username) + password. */
async function loginUsername(req, res) {
  const result = await authService.loginWithIdentifier(req.body);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTS);
  await recordAudit({ userId: result.user.id, action: 'USER_LOGIN', entityType: 'User', entityId: result.user.id, ipAddress: req.ip });
  res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
}

/** Step 1 of member login: resolve which member owns these last-4 Aadhaar digits. */
async function checkAadhaar(req, res) {
  const result = await authService.checkAadhaar(req.body.aadhaarLast4);
  res.json({ success: true, data: result });
}

/** Step 2a: first-time member login sets their password. */
async function setPasswordAadhaar(req, res) {
  const result = await authService.setPasswordViaAadhaar(req.body.aadhaarLast4, req.body.password);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTS);
  await recordAudit({ userId: result.user.id, action: 'PASSWORD_SET_FIRST_LOGIN', entityType: 'User', entityId: result.user.id, ipAddress: req.ip });
  res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
}

/** Step 2b: returning member login with their Aadhaar last-4 + password. */
async function loginAadhaar(req, res) {
  const result = await authService.loginViaAadhaar(req.body.aadhaarLast4, req.body.password);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, REFRESH_COOKIE_OPTS);
  await recordAudit({ userId: result.user.id, action: 'USER_LOGIN', entityType: 'User', entityId: result.user.id, ipAddress: req.ip });
  res.json({ success: true, data: { user: result.user, accessToken: result.accessToken } });
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

module.exports = {
  register,
  login,
  loginUsername,
  checkAadhaar,
  setPasswordAadhaar,
  loginAadhaar,
  refresh,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  me,
};
