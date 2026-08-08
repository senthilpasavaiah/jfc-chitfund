const { query } = require('../config/db');

/**
 * Records a notification "intent" (the message that would be sent).
 *
 * IMPORTANT: No live SMS/WhatsApp/Email/Push provider is connected in this
 * build - per project decision, nothing is actually dispatched right now.
 * Every call here is persisted so the intent, recipient, and content are
 * auditable. To go live later:
 *   - WhatsApp: wire in the Meta WhatsApp Cloud API (or Twilio's WhatsApp API)
 *   - SMS: wire in Twilio / an Indian DLT-registered SMS gateway (required
 *     for transactional SMS to Indian numbers)
 *   - Email: wire in SendGrid / SES
 *   - Push: wire in FCM
 * Swap the body of `dispatch()` below for the real provider call and change
 * the inserted `status` from LOGGED to PENDING/SENT/FAILED accordingly.
 */
async function dispatch({ memberId, channel, type, subject = null, body, createdById }) {
  const { rows } = await query(
    `INSERT INTO notifications (member_id, channel, type, subject, body, status, created_by_id)
     VALUES ($1, $2, $3, $4, $5, 'LOGGED', $6)
     RETURNING *`,
    [memberId, channel, type, subject, body, createdById]
  );
  return rows[0];
}

async function listForMember(memberId, { limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT * FROM notifications WHERE member_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [memberId, limit, offset]
  );
  return rows;
}

module.exports = { dispatch, listForMember };
