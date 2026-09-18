const express = require('express');
const { body } = require('express-validator');
const notificationService = require('../services/notification.service');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { recordAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('ADMIN', 'MANAGER'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const offset = Number(req.query.offset) || 0;
  const notifications = await notificationService.list({ limit, offset });
  res.json({ success: true, data: notifications });
});

// Admin-only for now, per current requirement. To open this up to all
// users later, change this to authorize('ADMIN', 'MANAGER', 'MEMBER') (or
// drop the authorize() call entirely) - nothing else here needs to change,
// since notificationService.create() doesn't itself assume who's calling it.
router.post(
  '/',
  authorize('ADMIN'),
  [
    body('memberId').isUUID().withMessage('A recipient member is required.'),
    body('channel').isIn(notificationService.CHANNELS).withMessage(`Channel must be one of: ${notificationService.CHANNELS.join(', ')}`),
    body('subject').optional({ checkFalsy: true }).trim(),
    body('body').trim().isLength({ min: 1 }).withMessage('Message body is required.'),
  ],
  validate,
  async (req, res) => {
    const notification = await notificationService.create({
      memberId: req.body.memberId,
      channel: req.body.channel,
      subject: req.body.subject,
      body: req.body.body,
      createdById: req.user.id,
    });
    await recordAudit({ userId: req.user.id, action: 'NOTIFICATION_CREATE', entityType: 'Notification', entityId: notification.id, metadata: { channel: notification.channel, memberId: notification.member_id }, ipAddress: req.ip });
    res.status(201).json({ success: true, data: notification });
  }
);

module.exports = router;
