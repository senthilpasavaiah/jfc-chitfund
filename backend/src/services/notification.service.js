const { query, withTransaction } = require('../config/db');
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

async function listForMember(memberId, { limit = 100, offset = 0 } = {}) {
  // GENERAL notifications are common portal announcements and must be visible
  // to every authenticated member. Personal notifications remain restricted
  // to their intended member.
  const { rows } = await query(
    `SELECT n.*, m.name AS member_name
     FROM notifications n
     LEFT JOIN members m ON m.id = n.member_id
     WHERE (n.type = 'GENERAL' AND n.member_id IS NULL)
        OR n.type = 'AUCTION_WON'
        OR n.member_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2 OFFSET $3`,
    [memberId, limit, offset]
  );
  return rows;
}

/** Admin/manager view of every logged notification, newest first. */
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
async function create({ memberId, memberIds, allMembers = false, channel, subject, body, createdById }) {
  if (!CHANNELS.includes(channel)) throw ApiError.badRequest(`Channel must be one of: ${CHANNELS.join(', ')}`);
  if (!body || !body.trim()) throw ApiError.badRequest('Message body is required.');

  let recipientIds = Array.isArray(memberIds) ? [...new Set(memberIds.filter(Boolean))] : [];
  if (memberId) recipientIds.push(memberId);
  recipientIds = [...new Set(recipientIds)];

  if (allMembers) {
    const { rows } = await query(`SELECT id FROM members ORDER BY name ASC`);
    recipientIds = rows.map((row) => row.id);
  }

  if (!allMembers && !recipientIds.length) throw ApiError.badRequest('Select at least one recipient or choose All members.');

  if (!allMembers) {
    const { rows: memberRows } = await query(
      `SELECT id FROM members WHERE id = ANY($1::uuid[])`,
      [recipientIds]
    );
    if (memberRows.length !== recipientIds.length) throw ApiError.notFound('One or more selected members were not found.');
  }

  const cleanSubject = subject && subject.trim() ? subject.trim() : null;
  const cleanBody = body.trim();

  return withTransaction(async (client) => {
    // A common/general notification is stored once with no member_id, so every
    // authenticated member can see it. Selected notifications remain one row
    // per recipient and are visible only to that recipient.
    if (allMembers) {
      const { rows } = await client.query(
        `INSERT INTO notifications (member_id, channel, type, subject, body, status, created_by_id)
         VALUES (NULL, $1, 'GENERAL', $2, $3, 'LOGGED', $4)
         RETURNING *`,
        [channel, cleanSubject, cleanBody, createdById]
      );
      return rows;
    }

    const created = [];
    for (const id of recipientIds) {
      const { rows } = await client.query(
        `INSERT INTO notifications (member_id, channel, type, subject, body, status, created_by_id)
         VALUES ($1, $2, 'GENERAL', $3, $4, 'LOGGED', $5)
         RETURNING *`,
        [id, channel, cleanSubject, cleanBody, createdById]
      );
      created.push(rows[0]);
    }
    return created;
  });
}

async function remove(id) {
  const { rows } = await query('DELETE FROM notifications WHERE id = $1 RETURNING id', [id]);
  if (!rows[0]) throw ApiError.notFound('Notification not found.');
  return rows[0];
}

module.exports = { dispatch, listForMember, list, create, remove, CHANNELS };
