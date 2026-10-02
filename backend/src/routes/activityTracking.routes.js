const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

function cleanText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

router.post('/page-view', async (req, res) => {
  const { path, title, sessionId, referrer } = req.body || {};
  const safePath = cleanText(path, 500);
  if (!safePath || !sessionId) return res.status(400).json({ success: false, message: 'path and sessionId are required' });

  const metadata = {
    sessionId: cleanText(sessionId, 100),
    path: safePath,
    title: cleanText(title, 200),
    referrer: cleanText(referrer, 500),
    startedAt: new Date().toISOString(),
    durationMs: 0,
    lastHeartbeatAt: new Date().toISOString(),
    visibility: 'visible',
  };

  try {
    const { rows } = await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES ($1, 'PAGE_VIEW', 'PAGE_VIEW', $2, $3, $4)
       RETURNING id, created_at`,
      [req.user.id, safePath, JSON.stringify(metadata), req.ip || null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Failed to record page view', error.message);
    res.status(202).json({ success: true, data: null });
  }
});

router.post('/page-view/heartbeat', async (req, res) => {
  const { activityId, durationMs, visibility = 'visible' } = req.body || {};
  if (!activityId) return res.status(400).json({ success: false, message: 'activityId is required' });

  const safeDuration = Math.max(0, Math.min(Number(durationMs) || 0, 24 * 60 * 60 * 1000));
  try {
    await query(
      `UPDATE audit_logs
          SET metadata = COALESCE(metadata, '{}'::jsonb)
            || jsonb_build_object(
              'durationMs', $1::int,
              'lastHeartbeatAt', NOW(),
              'visibility', $2::text
            )
        WHERE id = $3
          AND user_id = $4
          AND action = 'PAGE_VIEW'`,
      [Math.round(safeDuration), cleanText(visibility, 30), activityId, req.user.id]
    );
  } catch (error) {
    console.error('Failed to update page view heartbeat', error.message);
  }
  res.status(202).json({ success: true });
});

module.exports = router;
