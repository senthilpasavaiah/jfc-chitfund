const express = require('express');
const notificationService = require('../services/notification.service');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('ADMIN', 'MANAGER'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const offset = Number(req.query.offset) || 0;
  const notifications = await notificationService.list({ limit, offset });
  res.json({ success: true, data: notifications });
});

module.exports = router;
