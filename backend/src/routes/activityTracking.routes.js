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

router.post('/error', async (req, res) => {
  const { path, sessionId, source, message, status, method, endpoint, stack, userAgent } = req.body || {};
  try {
    const metadata = {
      path: cleanText(path, 500),
      sessionId: cleanText(sessionId, 100),
      source: cleanText(source, 50),
      message: cleanText(message, 1000),
      status: Number(status) || null,
      method: cleanText(method, 20),
      endpoint: cleanText(endpoint, 500),
      stack: cleanText(stack, 2000),
      userAgent: cleanText(userAgent, 500),
    };
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES ($1, 'FRONTEND_ERROR', 'ERROR', $2, $3, $4)`,
      [req.user.id, metadata.path || metadata.endpoint || 'frontend', JSON.stringify(metadata), req.ip || null]
    );
  } catch (error) {
    console.error('Failed to record frontend error', error.message);
  }
  res.status(202).json({ success: true });
});

router.get('/journey/:sessionId', async (req, res) => {
  try {
    const sessionId = cleanText(req.params.sessionId, 100);
    const { rows } = await query(
      `SELECT a.id, a.action, a.entity_id, a.metadata, a.created_at,
              COALESCE(m.name, u.phone) AS actor_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN members m ON m.user_id = u.id
        WHERE a.user_id = $1
          AND a.action IN ('PAGE_VIEW', 'FRONTEND_ERROR')
          AND COALESCE(a.metadata->>'sessionId', '') = $2
        ORDER BY a.created_at ASC`,
      [req.user.id, sessionId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Could not load session journey.' });
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
