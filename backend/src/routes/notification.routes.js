const express = require('express');
const { body, param } = require('express-validator');
const notificationService = require('../services/notification.service');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { recordAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const offset = Number(req.query.offset) || 0;

  // Admins/managers can view the notification log. Regular members can
  // view their own portal notifications only. This must not depend on
  // chit participation: a member who is not in any chit can still receive
  // general/admin notifications.
  const notifications = (req.user.role === 'ADMIN' || req.user.role === 'MANAGER')
    ? await notificationService.list({ limit, offset })
    : req.user.memberId
      ? await notificationService.listForMember(req.user.memberId, { limit, offset })
      : [];

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
    body('memberId').optional({ checkFalsy: true }).isUUID().withMessage('Invalid recipient member.'),
    body('memberIds').optional().isArray({ min: 1 }).withMessage('memberIds must be a non-empty array.'),
    body('memberIds.*').optional().isUUID().withMessage('Invalid recipient member.'),
    body('allMembers').optional().isBoolean().withMessage('allMembers must be true or false.'),
    body('channel').isIn(notificationService.CHANNELS).withMessage(`Channel must be one of: ${notificationService.CHANNELS.join(', ')}`),
    body('subject').optional({ checkFalsy: true }).trim(),
    body('body').trim().isLength({ min: 1 }).withMessage('Message body is required.'),
  ],
  validate,
  async (req, res) => {
    const notification = await notificationService.create({
      memberId: req.body.memberId,
      memberIds: req.body.memberIds,
      allMembers: req.body.allMembers === true || req.body.allMembers === 'true',
      channel: req.body.channel,
      subject: req.body.subject,
      body: req.body.body,
      createdById: req.user.id,
    });
    await recordAudit({ userId: req.user.id, action: 'NOTIFICATION_CREATE', entityType: 'Notification', entityId: notification.id, metadata: { channel: notification.channel, memberId: notification.member_id }, ipAddress: req.ip });
    res.status(201).json({ success: true, data: notification });
  }
);


router.delete(
  '/:id',
  authorize('ADMIN'),
  [param('id').isUUID().withMessage('Invalid notification id.')],
  validate,
  async (req, res) => {
    const deleted = await notificationService.remove(req.params.id);
    await recordAudit({
      userId: req.user.id,
      action: 'NOTIFICATION_DELETE',
      entityType: 'Notification',
      entityId: deleted.id,
      metadata: {},
      ipAddress: req.ip,
    });
    res.json({ success: true, data: deleted });
  }
);

module.exports = router;
