const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');

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

/** Admin-only view of every logged notification, newest first. */
async function list({ limit = 100, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT n.*, m.name AS member_name
     FROM notifications n
     LEFT JOIN members m ON m.id = n.member_id
     ORDER BY n.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

const CHANNELS = ['SMS', 'WHATSAPP', 'EMAIL', 'PUSH'];

/**
 * A person manually composes and "sends" a notification (still just
 * logged, per the note above `dispatch()` - no live provider is wired up
 * yet). This is the same `dispatch()` every automatic notification already
 * goes through; the only difference is a human picked the recipient and
 * wrote the message instead of a system action doing it.
 */
async function create({ memberId, channel, subject, body, createdById }) {
  if (!memberId) throw ApiError.badRequest('A recipient member is required.');
  if (!CHANNELS.includes(channel)) throw ApiError.badRequest(`Channel must be one of: ${CHANNELS.join(', ')}`);
  if (!body || !body.trim()) throw ApiError.badRequest('Message body is required.');

  const { rows: memberRows } = await query('SELECT id FROM members WHERE id = $1', [memberId]);
  if (!memberRows[0]) throw ApiError.notFound('Member not found.');

  return dispatch({
    memberId,
    channel,
    type: 'GENERAL',
    subject: subject && subject.trim() ? subject.trim() : null,
    body: body.trim(),
    createdById,
  });
}

module.exports = { dispatch, listForMember, list, create, CHANNELS };
